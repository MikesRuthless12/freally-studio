/**
 * PunchlineBank — MASSIVE celebrity & pop culture punchline reference system.
 * 5,000+ clever punchlines organized by rhyme family with mood tagging.
 *
 * Each punchline is a complete lyric line that ends with a word from a specific
 * rhyme family. The RhymeEngine matches setup lines with punchlines automatically.
 *
 * Categories: Rappers, Musicians, Actors, Athletes, Movies/TV, Game Shows,
 * Historical Icons, Song Titles
 */

import { pick } from './GenreBank';

// ============================================================================
// CELEBRITY PUNCHLINE PHRASES — organized by rhyme family
// Each family has: setup lines (end with common words) + punchlines (end with names)
// The system pairs them via rhyme matching in AABB/ABAB schemes
// ============================================================================

const PUNCHLINE_PHRASES = {

    // ========================================================================
    // 'ent' family — 50 Cent
    // ========================================================================
    'ent': {
        all: [
            // --- 50 Cent punchlines ---
            "stackin' paper like 50 cent",
            "get rich or die tryin' 50 cent",
            "bulletproof mentality 50 cent",
            "in da club runnin' up 50 cent",
            "candy shop money 50 cent",
            "many men couldn't stop 50 cent",
            "window shopper watch me ball 50 cent",
            "nine shots couldn't stop 50 cent",
            "ayo technology like 50 cent",
            "p.i.m.p. of the game 50 cent",
            "wanksta couldn't match 50 cent",
            "power moves on the screen 50 cent",
            "vitamin water money 50 cent",
            "g-unit soldier 50 cent",
            // --- Setup lines ---
            "doin' work to pay the rent",
            "every dollar that i spent",
            "money talks you know i meant",
            "grinding hard i represent",
            "came up from the pavement and cement",
            "independent on my own ascent",
            "they don't know where my patience went",
            "calculated every single cent",
            "blood and sweat is what it meant",
            "made my mark and left a dent",
            "this was heaven sent",
            "here to make a statement not a dent",
            "whole life building on this fundament",
            "came to pay the rent",
            "living proof of the ascent",
            "never backing down from the descent",
            "everything i touch is heaven sent",
            "walking proof of the experiment",
            "proof is in the development",
            "self-made from the basement to the penthouse rent",
            "sharpened like a blade on the whetstone bent",
            "flew the coop like a bird from the tent",
            "born with a fire that was permanent",
            "wrote a testament to the testament",
            "eloquent words from the settlement",
            "my accomplishment is self-evident",
            "no supplement for the compliment",
            "magnificent in every increment",
            "monument to the predicament i bent",
        ],
        dark: [
            "cold world but i represent",
            "survival mode a hundred percent",
            "the streets remember every cent",
            "dark cement where the blood was spent",
            "trauma lent the anger that i vent",
            "hell-bent on the punishment",
        ],
        aggressive: [
            "coming for the crown don't repent",
            "war mode every cent",
            "bodies drop wherever i went",
            "malcontent with violent intent",
            "opponents bent wherever i went",
            "dominant force a hundred percent",
        ],
    },

    // ========================================================================
    // 'action' family — Michael Jackson, Janet Jackson, Samuel L. Jackson
    // ========================================================================
    'action': {
        all: [
            // --- Michael Jackson punchlines ---
            "now i'm bad like michael jackson",
            "smooth criminal michael jackson",
            "off the wall like michael jackson",
            "beat it call me michael jackson",
            "don't stop til you get enough michael jackson",
            "remember the time michael jackson",
            "the way you make me feel michael jackson",
            "wanna be startin' somethin' michael jackson",
            "rock with you like michael jackson",
            "billie jean moonwalk michael jackson",
            "thriller night it's michael jackson",
            "man in the mirror michael jackson",
            "black or white it's michael jackson",
            "heal the world like michael jackson",
            "they don't care about us michael jackson",
            "dangerous on the floor michael jackson",
            // --- Janet Jackson punchlines ---
            "got the nasty groove like janet jackson",
            "rhythm nation vibes janet jackson",
            "miss you much and that's a fact like janet jackson",
            "control the game like janet jackson",
            "together again like janet jackson",
            "all for you that's janet jackson",
            // --- Samuel L. Jackson punchlines ---
            "say what again like samuel l. jackson",
            "pulp fiction lines samuel l. jackson",
            "motherlovin' legend samuel l. jackson",
            "snakes on a plane samuel l. jackson",
            "avengers assembled samuel l. jackson",
            "nick fury mode samuel l. jackson",
            // --- Setup lines ---
            "puttin' words into action",
            "got the whole world's satisfaction",
            "moving with the main attraction",
            "this is more than just a fraction",
            "no distraction just the traction",
            "calculated every fraction",
            "whole career a chain reaction",
            "this ain't fiction this is action",
            "never slowing down the traction",
            "causing a distraction with this action",
            "chemical reaction when i'm in action",
            "building the attraction with this traction",
            "got the crowd's satisfaction",
            "movie star with the right reaction",
            "pulling strings like a puppeteer's extraction",
            "flawless execution no retraction",
            "nuclear reaction from the interaction",
            "subtract the distraction multiply the action",
            "get the satisfaction from the transaction",
            "abstract art in the extraction",
            "contract signed for the main attraction",
            "impact of the counteraction",
            "exact precision in every action",
            "compact power maximum traction",
        ],
        dark: [
            "dark thoughts pulled into action",
            "underworld transactions gaining traction",
            "fatal attraction in the subtraction",
            "cold-blooded extraction satisfaction",
        ],
        aggressive: [
            "knockout punch with maximum traction",
            "dominate the competition satisfaction",
            "hostile takeover in action",
            "chain reaction of destruction satisfaction",
        ],
    },

    // ========================================================================
    // 'ee' family — Bruce Lee, Muhammad Ali, Jay-Z, Cardi B, Ice-T
    // ========================================================================
    'ee': {
        all: [
            // --- Bruce Lee punchlines ---
            "hands of fury just like bruce lee",
            "enter the dragon bruce lee",
            "one-inch punch like bruce lee",
            "be water my friend bruce lee",
            "way of the dragon bruce lee",
            "martial arts master bruce lee",
            "fists of fury like bruce lee",
            "game of death with bruce lee",
            // --- Muhammad Ali punchlines ---
            "float like a butterfly ali",
            "greatest of all time ali",
            "rumble in the jungle ali",
            "sting like a bee ali",
            "i am the greatest ali",
            "shook up the world ali",
            "impossible is nothing ali",
            "thriller in manila ali",
            // --- Jay-Z punchlines ---
            "mogul moves just like jay-z",
            "brooklyn's finest that's jay-z",
            "roc nation empire jay-z",
            "99 problems but i'm jay-z",
            "big pimpin' like jay-z",
            "run this town like jay-z",
            "reasonable doubt it's jay-z",
            "blueprint to the top jay-z",
            "hard knock life jay-z",
            "empire state of mind jay-z",
            "on to the next one jay-z",
            "dirt off your shoulder jay-z",
            "holy grail of the industry jay-z",
            // --- Cardi B punchlines ---
            "money moves like cardi b",
            "bodak yellow cardi b",
            "i like it like that cardi b",
            "regular degular cardi b",
            "wap the competition cardi b",
            "press play like cardi b",
            // --- Ice-T punchlines ---
            "original gangster ice-t",
            "colors of the street ice-t",
            "law and order like ice-t",
            // --- Andre 3000 / Outkast punchlines ---
            "hey ya shaking it like andre three",
            "outkast but i'm number one see",
            "aquemini aligned in the galaxy free",
            "so fresh so clean like outkast in the spree",
            "roses and bombs over baghdad i'm free",
            // --- Ice Cube punchlines ---
            "today was a good day ice cube agree",
            "straight outta compton ice cube the og",
            "check yourself before you wreck the decree",
            "friday feeling all is free",
            // --- Missy Elliott punchlines ---
            "work it flip it missy guarantee",
            "lose control like missy on the spree",
            "supa dupa fly you see",
            // --- Setup lines ---
            "unstoppable and i'm breaking free",
            "this is my destiny",
            "open up your eyes and see",
            "pressure makes a diamond that's the key",
            "no one's ever gonna stop me being free",
            "empire built for the world to see",
            "spread my wings across the sea",
            "legendary status guarantee",
            "made it out and now i'm free",
            "crown me the king or the queen bee",
            "living life with a guarantee",
            "stand tall like a redwood tree",
            "every eye on me",
            "born to reign supreme you see",
            "rising up from poverty",
            "unlocking every door with the key",
            "this is what it means to be free",
            "masterpiece for all to see",
            "writing my own history",
            "defying all the gravity",
            "my legacy will set me free",
            "sailing on an endless sea",
            "holding onto what i believe",
            "rooftop views and the skyline marquee",
            "trophy case for the referee",
            "pedigree of the highest degree",
            "emcee with a ph.d",
            "odyssey of the bourgeoisie",
            "filigree on the family tree",
            "guarantee this is my jubilee",
        ],
        dark: [
            "shadows follow me",
            "darkness couldn't swallow me",
            "haunted by the things i see",
            "trapped inside a memory",
            "drowning in the misery",
            "price of fame is the agony",
        ],
        aggressive: [
            "step to me and you will see",
            "dominant force that's the key",
            "undefeated that's me",
            "wrecking ball on a killing spree",
            "catch me if you can but you'll never be free",
            "guillotine for the wannabe",
        ],
    },

    // ========================================================================
    // 'ake' family — Drake
    // ========================================================================
    'ake': {
        all: [
            // --- Drake punchlines ---
            "started from the bottom just like drake",
            "god's plan in the making like drake",
            "hotline bling it's drake",
            "know yourself just like drake",
            "headlines every day like drake",
            "best i ever had like drake",
            "take care of the game like drake",
            "nice for what they call me drake",
            "nonstop on my grind like drake",
            "one dance at a time like drake",
            "passion fruit ambition just like drake",
            "toosie slide through the gate like drake",
            "money in the grave like drake",
            "life is good and i'm awake like drake",
            "hold on we're going home drake",
            "child's play in the race like drake",
            "way too good at goodbyes for the sake of drake",
            "laugh now cry later like drake",
            // --- Setup lines ---
            "building something real no mistake",
            "grinding for my family's sake",
            "every move i make is a step i take",
            "can't stop won't stop stay awake",
            "rise and grind for my own sake",
            "never take a loss only breaks i make",
            "hit 'em with the crossover shake",
            "everything i touch is an earthquake",
            "heartbreak made me great no mistake",
            "been through hell but i didn't break",
            "real recognize real no fake",
            "opportunity is mine to take",
            "make or break this is what's at stake",
            "avalanche hit you like a snowflake",
            "baking bread for the whole lake",
            "rattlesnake rattle but i don't quake",
            "cheesecake lifestyle they can't partake",
            "daybreak to the handshake",
            "mandrake potion that i intake",
            "namesake of the double take",
            "wide awake at the overtake",
        ],
        dark: [
            "dark roads every choice i make",
            "nightmares i'm still wide awake",
            "heartache that i can't forsake",
            "the ground beneath me starts to quake",
        ],
        aggressive: [
            "break every bone for my own sake",
            "earthquake shake until they ache",
            "coming for your throne make no mistake",
        ],
    },

    // ========================================================================
    // 'est' family — Kanye West
    // ========================================================================
    'est': {
        all: [
            // --- Kanye West punchlines ---
            "put me to the test like kanye west",
            "power moves like kanye west",
            "stronger every day like kanye west",
            "graduation day kanye west",
            "gold digger hustle kanye west",
            "through the wire kanye west",
            "runaway genius kanye west",
            "all of the lights kanye west",
            "heartless grind like kanye west",
            "ultralight beam kanye west",
            "jesus walks with kanye west",
            "flashing lights kanye west",
            "can't tell me nothing kanye west",
            "touch the sky like kanye west",
            "my beautiful dark twisted fantasy kanye west",
            "mercy on the beat kanye west",
            "bound to be the best kanye west",
            "father stretch my hands kanye west",
            // --- Setup lines ---
            "rising from the bottom to the crest",
            "everything i do is blessed",
            "never settling for anything less than best",
            "put it on my chest i'm obsessed",
            "standing out above the rest",
            "born to lead the quest",
            "north south east and west",
            "survived every single test",
            "better than the rest and i'm blessed",
            "manifest success i am possessed",
            "no contest i'm the best",
            "battle-tested i'm impressed",
            "underdressed but still the best",
            "on a conquest never rest",
            "put me to the ultimate test",
            "golden crest upon the nest",
            "reinvest in the interest",
            "bulletproof vest and i'm obsessed",
            "protest the rest i'm progressed",
            "eagle's nest high above the rest",
            "acid test and i'm still the best",
            "treasure chest i'm unimpressed",
            "self-expressed and still possessed",
        ],
        dark: [
            "dark nights i confessed",
            "demons in my chest i'm possessed",
            "suppressed but never depressed",
            "distressed but still the best",
        ],
        aggressive: [
            "domination manifest the best",
            "crush the rest i'm obsessed",
            "no arrest for the conquest",
        ],
    },

    // ========================================================================
    // 'ain' family — Lil Wayne, Gucci Mane, Kurt Cobain, Mark Twain
    // ========================================================================
    'ain': {
        all: [
            // --- Lil Wayne punchlines ---
            "hurricane flow like lil wayne",
            "a milli bars like lil wayne",
            "lollipop money lil wayne",
            "best rapper alive lil wayne",
            "fireman spitting flame lil wayne",
            "carter legacy lil wayne",
            "mirror on the wall lil wayne",
            "got money on my brain lil wayne",
            "no ceilings on the lane lil wayne",
            "mrs. officer on the lane lil wayne",
            "she will remember the name lil wayne",
            "drop the world like lil wayne",
            "how to love the pain lil wayne",
            // --- Gucci Mane punchlines ---
            "ice cold drip like gucci mane",
            "trap house king gucci mane",
            "lemonade and gucci mane",
            "wasted on the chain like gucci mane",
            "bricks and hammers gucci mane",
            "first day out free again gucci mane",
            "east atlanta santa gucci mane",
            // --- Kurt Cobain punchlines ---
            "smells like teen spirit kurt cobain",
            "grunge rock anthem kurt cobain",
            "nevermind the pain like kurt cobain",
            "lithium running through my brain kurt cobain",
            "come as you are kurt cobain",
            // --- Mark Twain punchlines ---
            "storytelling genius mark twain",
            "adventures on the lane mark twain",
            "reports of my death exaggerated mark twain",
            // --- Juice WRLD punchlines ---
            "lucid dreams in the rain juice wrld",
            "all girls are the same juice wrld slain",
            "legends never die that's the refrain juice wrld",
            "robbery of my brain juice wrld",
            // --- Setup lines ---
            "spitting fire through the rain",
            "genius level use my brain",
            "running through the fast lane",
            "no pain no gain that's the game i maintain",
            "blood in my veins running through the terrain",
            "breaking every link in the chain",
            "standing in the pouring rain",
            "can't stop the train",
            "i'm insane in the membrane",
            "never let 'em see you in pain",
            "campaign trail to the champagne",
            "hurricanes couldn't stop my campaign",
            "from the struggle to the champagne",
            "unchained from the ball and chain",
            "mundane to the gold champagne",
            "migraine from the hurricane",
            "propane ignite the domain",
            "cellophane over the windowpane",
            "ascertain the right of the sovereign reign",
            "weather vane spinning in the acid rain",
            "evergreen lane to the memory lane",
            "porcelain skin and a diamond chain",
            "entertain the crowd on the main terrain",
        ],
        dark: [
            "dark clouds but i don't complain",
            "cold blood running through my vein",
            "bloodstain on the windowpane",
            "midnight train and the novocaine",
            "phantom pain i can't explain",
        ],
        aggressive: [
            "ball and chain on the enemy slain",
            "raise the cane and the hurricane",
            "warplane overhead i don't complain",
        ],
    },

    // ========================================================================
    // 'own' family — James Brown, Chris Brown, Motown
    // ========================================================================
    'own': {
        all: [
            // --- James Brown punchlines ---
            "get on up like james brown",
            "i feel good like james brown",
            "papa's got a brand new bag james brown",
            "funky like the godfather james brown",
            "living in america james brown",
            "soul brother number one james brown",
            "get up offa that thing james brown",
            "say it loud i'm proud like james brown",
            // --- Chris Brown punchlines ---
            "forever young like chris brown",
            "yeah three times chris brown",
            "run it like chris brown",
            "don't judge me now chris brown",
            "loyal to the crown chris brown",
            // --- Motown punchlines ---
            "smooth harmonies like motown",
            "soundtrack of the city motown",
            "soul music from motown",
            "hitsville usa motown",
            // --- Lil Durk punchlines ---
            "voice of the trenches hold it down lil durk in the town",
            "all my life i've been down lil durk with the crown",
            // --- Polo G punchlines ---
            "hall of fame wearing the crown polo g in the town",
            "rapstar holding it down polo g renowned",
            // --- Movie references ---
            "chinatown vibes when the sun goes down",
            "goodfellas running this whole town",
            "godfather sitting with the crown",
            // --- Setup lines ---
            "wearing this crown never let it down",
            "king of the underground",
            "baddest in the town",
            "heavyweight champion holding the crown",
            "they tried to tear me down",
            "never back down from the showdown",
            "i came to shut it down",
            "whole city hear the sound",
            "built this kingdom from the ground",
            "earned this crown don't let it down",
            "hold it down for the town",
            "legend status in the town",
            "broke the system and the compound",
            "turnin' the whole ship around",
            "merry-go-round of the breakdown",
            "showdown countdown to the lockdown",
            "throw it down in the hoedown",
            "sundown in the boomtown",
            "wore the golden gown and the crown",
            "I run it uptown downtown all around",
            "from the battleground straight to the playground",
            "knocked down but never out I held my ground",
            "write my name all over this town",
            "from a clown to a king wearing the crown",
        ],
        dark: [
            "darkness all around but i don't drown",
            "six feet deep in the underground",
            "ghost town where the tears roll down",
            "shadows drip and the walls break down",
            "facedown in the coldest part of town",
        ],
        aggressive: [
            "burn it to the ground",
            "shutdown lockdown of the crown",
            "tear this whole thing down",
            "chokehold on the battleground",
        ],
    },

    // ========================================================================
    // 'ock' family — The Rock, Tupac, Chris Rock
    // ========================================================================
    'ock': {
        all: [
            // --- The Rock punchlines ---
            "can you smell it like the rock",
            "lay the smackdown like the rock",
            "people's champ they call me the rock",
            "electrifying like the rock",
            "know your role just like the rock",
            "it doesn't matter like the rock",
            "eyebrow raised just like the rock",
            "brahma bull on the block like the rock",
            // --- Tupac punchlines ---
            "all eyes on me like tupac",
            "keep it real just like tupac",
            "dear mama from the heart tupac",
            "changes coming like tupac",
            "thug life tatted like tupac",
            "california love tupac",
            "ambitionz az a ridah tupac",
            "me against the world tupac",
            "hit em up like tupac",
            "only god can judge me tupac",
            "keep ya head up like tupac",
            "so many tears but still tupac",
            "brenda's got a baby tupac on the block",
            "i get around the clock like tupac",
            // --- Chris Rock punchlines ---
            "punchlines kill like chris rock",
            "comedy king chris rock",
            "everybody hates the talk chris rock",
            // --- Travis Scott punchlines ---
            "highest in the room round the clock travis rock",
            "astroworld shaking like aftershock",
            // --- Pop Smoke punchlines ---
            "got it on lock like pop smoke on the block",
            "dior dripping on the clock pop smoke",
            // --- Jason Statham punchlines ---
            "transporter on the dock jason statham knock",
            "crank it up on the block like statham",
            // --- Setup lines ---
            "keep it real around the block",
            "ticking like a time bomb clock",
            "run the block from twelve to twelve o'clock",
            "hard as a rock steady as a clock",
            "knock knock who's there at the block",
            "never stop grinding round the clock",
            "stacking up the block",
            "solid as a rock",
            "can't stop won't stop round the clock",
            "shots fired round the block",
            "building up the block",
            "empire built on every block",
            "deadlock gridlock on the chopping block",
            "padlock on the writer's block",
            "shamrock luck around the clock",
            "peacock strut on the dock",
            "aftershock from the livestock",
            "woodstock to the penthouse stock",
            "shellshock but i never stop",
            "bedrock to the clockwork jock",
            "roadblock on the interlock",
        ],
        dark: [
            "cold nights on the block",
            "survival on the block round the clock",
            "tick tock on the executioner's block",
            "hemlock in the deadlock",
        ],
        aggressive: [
            "rock the block and shock the flock",
            "warlock bringing the aftershock",
            "wrecking ball on the cellblock",
        ],
    },

    // ========================================================================
    // 'ell' family — Denzel, Dave Chappelle, Pharrell, Adele
    // ========================================================================
    'ell': {
        all: [
            // --- Denzel Washington punchlines ---
            "oscar moves just like denzel",
            "training day with denzel",
            "king kong ain't got nothing on me like denzel",
            "man on fire that's denzel",
            "american gangster denzel",
            "equalizer moves like denzel",
            "glory days like denzel",
            "fences built like denzel",
            "book of eli wisdom like denzel",
            "malcolm x power like denzel",
            "flight control precision like denzel",
            "remember the titans like denzel",
            // --- Dave Chappelle punchlines ---
            "punchlines hit like dave chappelle",
            "comedy special dave chappelle",
            "rick james moment dave chappelle",
            "keeping it real dave chappelle",
            "half baked genius dave chappelle",
            "gotcha moment dave chappelle",
            // --- Pharrell punchlines ---
            "happy vibes like pharrell",
            "i'm happy clap along pharrell",
            "skateboard style pharrell",
            "get lucky with pharrell",
            "neptunes on the beat pharrell",
            "frontin' on the world pharrell",
            // --- Adele punchlines ---
            "rolling in the deep like adele",
            "hello from the other side adele",
            "set fire to the rain adele",
            "someone like you sang adele",
            "easy on me said adele",
            "skyfall anthem like adele",
            // --- Morgan Freeman punchlines ---
            "narrate my life morgan freeman can tell",
            "voice like velvet morgan freeman spell",
            "shawshank tunnel dug through hell morgan freeman",
            // --- Setup lines ---
            "got a story that i gotta tell",
            "everything i touch i do it well",
            "hear the sound of every bell",
            "living in a five-star hotel",
            "can't you tell the story's parallel",
            "words cut sharp like a bombshell",
            "cast a spell you can never dispel",
            "fell from grace and i fell through hell",
            "clientele from the carousel",
            "every verse a story to tell",
            "wishing well but only time will tell",
            "rise and fell but i'm doing well",
            "this my farewell to the wishing well",
            "eggshell walking on the personnel",
            "citadel and the sentinel",
            "infidel in the parallel",
            "seashell echoes in the dell",
            "personnel at the motel carousel",
            "nutshell of the oversell",
            "gazelle running from the bombshell",
            "cartel money at the hotel",
            "excel compel and propel",
            "undersell but never dwell",
        ],
        dark: [
            "been through hell and i can tell",
            "dark side of the carousel",
            "ringing like a funeral bell",
            "tortured soul you know me well",
            "bottomless well and a prison cell",
        ],
        aggressive: [
            "rebel yell from the citadel",
            "bombshell i can't quell",
            "raise hell break the spell",
        ],
    },

    // ========================================================================
    // 'een' family — James Dean, Charlie Sheen, Billie Jean (song)
    // ========================================================================
    'een': {
        all: [
            // --- James Dean punchlines ---
            "rebel cool just like james dean",
            "rebel without a cause james dean",
            "live fast die young james dean",
            "boulevard of broken dreams james dean",
            "east of eden like james dean",
            "giant on the silver screen james dean",
            // --- Charlie Sheen punchlines ---
            "winning hard like charlie sheen",
            "two and a half bars charlie sheen",
            "tiger blood flowing charlie sheen",
            "wild thing on the scene charlie sheen",
            "platoon veteran charlie sheen",
            // --- Billie Jean (song) punchlines ---
            "the kid is not my son billie jean",
            "moonwalking on the scene billie jean",
            "not my lover billie jean",
            // --- Serena Williams punchlines ---
            "grand slam queen of the scene serena the queen",
            "ace serve supreme serena the queen",
            // --- Vin Diesel punchlines ---
            "family first on the scene vin diesel the machine",
            "furious and fast like a gasoline machine",
            // --- Setup lines ---
            "freshest thing you've ever seen",
            "living life behind the screen",
            "riding in the limousine",
            "making money like a machine",
            "sharp and dressed so clean",
            "everything i do is evergreen",
            "baddest on the magazine",
            "king or queen of the scene",
            "in between the dream and the routine",
            "breaking through the quarantine",
            "submarine in the mainstream",
            "gasoline on the fire supreme",
            "wolverine on the scene i'm keen",
            "unforeseen on the evergreen",
            "trampoline to the figurine",
            "mezzanine of the tangerine",
            "nicotine-free and evergreen",
            "pristine guillotine of the routine",
            "halloween on the tambourine",
            "amphetamine of the magazine scene",
            "byzantine queen on the screen",
            "velveteen on the nectarine",
            "caffeine dream running clean",
            "intervene in the unforeseen",
        ],
        dark: [
            "dark side of the silver screen",
            "nightmares in the magazine",
            "gangrene on the halloween",
            "quarantine on the nicotine",
        ],
        aggressive: [
            "guillotine on the war machine",
            "wolverine slash the scene clean",
            "predator mean like a war machine",
        ],
    },

    // ========================================================================
    // 'one' family — Al Capone, Sylvester Stallone, Post Malone
    // ========================================================================
    'one': {
        all: [
            // --- Al Capone punchlines ---
            "run the city like al capone",
            "untouchable al capone",
            "empire of the unknown al capone",
            "organized crime al capone",
            "prohibition boss al capone",
            "scarface of chicago al capone",
            // --- Sylvester Stallone punchlines ---
            "rocky spirit like stallone",
            "never backing down like stallone",
            "eye of the tiger stallone",
            "yo adrian it's stallone",
            "expendable and known stallone",
            "rambo mode stallone",
            "over the top like stallone",
            "demolition man stallone",
            // --- Post Malone punchlines ---
            "rockstar vibes like post malone",
            "sunflower sipping post malone",
            "congratulations post malone",
            "white iverson post malone",
            "circles going round post malone",
            "better now like post malone",
            "psycho with the undertone post malone",
            // --- Game of Thrones punchlines ---
            "winter is coming for the iron throne",
            "bend the knee before the throne",
            "a lannister always pays what is owed to the bone",
            // --- Setup lines ---
            "sitting on the iron throne",
            "empire built from skin and bone",
            "rolling stone to the danger zone",
            "standing on my own i've grown",
            "call me on the telephone",
            "microphone and megaphone",
            "every seed i've ever sown",
            "cornerstone of the unknown",
            "king on the throne",
            "flesh and blood and skin and bone",
            "carved in stone",
            "from the unknown to the well-known",
            "monotone to the ozone",
            "baritone on the saxophone",
            "cobblestone to the cornerstone",
            "tombstone but i've never been overthrown",
            "milestone after milestone shown",
            "limestone fortress on my own",
            "backbone of the war zone",
            "headstone read unknown but homegrown",
            "acetone strip it to the bone",
            "cyclone in the comfort zone",
        ],
        dark: [
            "cold as stone all alone",
            "shadows follow me at the danger zone",
            "dial tone nobody's home alone",
            "grindstone sharpened to the bone",
        ],
        aggressive: [
            "dethrone the king upon the throne",
            "warzone level to the bone",
            "cyclone fury fully blown",
        ],
    },

    // ========================================================================
    // 'oss' family (ust2) — Rick Ross, Diana Ross, Bob Ross
    // ========================================================================
    'ust2': {
        all: [
            // --- Rick Ross punchlines ---
            "biggest boss like rick ross",
            "hustlin' hard like rick ross",
            "everyday i'm hustlin' rick ross",
            "boss status like rick ross",
            "maybach music rick ross",
            "push it to the limit rick ross",
            "port of miami rick ross",
            "aston martin music like rick ross",
            "b.m.f. blowin' money rick ross",
            "rich forever rick ross",
            // --- Diana Ross punchlines ---
            "supreme diva diana ross",
            "ain't no mountain high diana ross",
            "stop in the name of love diana ross",
            "upside down like diana ross",
            "i'm coming out diana ross",
            // --- Bob Ross punchlines ---
            "happy little trees like bob ross",
            "no mistakes just happy accidents bob ross",
            "painting masterpieces bob ross",
            "beat the devil out of it bob ross",
            // --- Setup lines ---
            "never counting up the loss",
            "i'm the boss you can't cross",
            "gold chain with the gloss",
            "power moves at any cost",
            "bridges burned and battles lost",
            "winter came and brought the frost",
            "every line that i toss",
            "pay the cost to be the boss",
            "throw em like a coin toss",
            "floss and gloss i'm the boss",
            "lacrosse to the double cross",
            "albatross hanging like the sauce",
            "exhaust the resource at any cost",
            "dental floss on the moss",
            "toss the loss and emboss",
            "applesauce money no loss",
            "criss-cross like a motocross boss",
        ],
        dark: [
            "everything has a cost",
            "counting bodies from the loss",
            "permafrost on the holocaust",
            "double-cross left me at a loss",
        ],
        aggressive: [
            "hostile takeover at any cost",
            "body toss at the boss",
        ],
    },

    // ========================================================================
    // 'ole' family — J. Cole
    // ========================================================================
    'ole': {
        all: [
            // --- J. Cole punchlines ---
            "went platinum like j. cole",
            "no features needed j. cole",
            "forest hills drive j. cole",
            "born sinner like j. cole",
            "dreamville legend j. cole",
            "middle child but in control j. cole",
            "dollar and a dream j. cole",
            "crooked smile j. cole",
            "wet dreamz remember j. cole",
            "power trip like j. cole",
            "no role modelz like j. cole",
            "love yourz from the soul j. cole",
            "january 28th j. cole",
            "apparently i'm j. cole",
            // --- Nat King Cole punchlines ---
            "unforgettable like nat king cole",
            "l-o-v-e from the soul nat king cole",
            "mona lisa stole the whole show nat king cole",
            // --- Setup lines ---
            "real music from the heart and soul",
            "living life playing the role",
            "took control of the bankroll",
            "heart of gold but i paid the toll",
            "rock and roll on a stroll",
            "reached my goal from the console",
            "casserole to the payroll",
            "whole patrol on a roll",
            "sold my soul for the gold",
            "loophole in the protocol",
            "parole from the rigmarole",
            "flagpole on the north pole",
            "tadpole to the magnolia sole",
            "pothole on the road to the goal",
            "manhole cover on the soul patrol",
            "guacamole on the bankroll",
            "rock and roll to the stroll",
            "remote control of the whole console",
            "beanpole climbing to the top of the pole",
        ],
        dark: [
            "darkness in my soul",
            "swallowed whole by the black hole",
            "rabbit hole deeper than the mole",
            "death toll on the parole",
        ],
        aggressive: [
            "steamroll over the whole patrol",
            "bullet hole in the protocol",
            "out of control and on a roll",
        ],
    },

    // ========================================================================
    // 'ash' family — Johnny Cash
    // ========================================================================
    'ash': {
        all: [
            // --- Johnny Cash punchlines ---
            "walk the line like johnny cash",
            "ring of fire johnny cash",
            "man in black johnny cash",
            "folsom prison johnny cash",
            "boy named sue johnny cash",
            "hurt but never crash johnny cash",
            "god's gonna cut you down johnny cash",
            "jackson running with the cash",
            // --- The Clash punchlines ---
            "should i stay or should i go the clash",
            "london calling through the flash the clash",
            "rock the casbah with the clash",
            // --- Setup lines ---
            "burning through the world in a flash",
            "stacking up the cash and the stash",
            "gone in a flash",
            "lightning fast like a whiplash",
            "turning trash into cash",
            "thunder crash and the backlash",
            "dollar signs and the cash splash",
            "making moves don't be rash",
            "cold hard cash from the stash",
            "calabash to the mustache cash",
            "panache and the eyelash flash",
            "balderdash in the aftermath",
            "whiplash from the car crash",
            "slapdash but i stack the cash",
            "potash to the cold hard cash",
            "mishmash of the rehash",
            "tongue-lash and the backlash clash",
        ],
        dark: [
            "empires burn to ash",
            "watching everything crash and dash",
            "phoenix rising from the ash",
            "slash and burn to ash",
        ],
        aggressive: [
            "skull and crossbones slash and crash",
            "gnash teeth and the whiplash",
        ],
    },

    // ========================================================================
    // 'ool' family — Ja Rule, Old School
    // ========================================================================
    'ool': {
        all: [
            // --- Ja Rule punchlines ---
            "always murderin' like ja rule",
            "put it on me like ja rule",
            "between me and you ja rule",
            "holla holla like ja rule",
            "livin' it up ja rule",
            // --- NF punchlines ---
            "the search is real keeping it cool nf in the pool",
            "let you down but that's the rule nf like a tool",
            // --- Price is Right punchlines ---
            "come on down and keep it cool price is right school",
            "showcase showdown like a jewel price is right rule",
            // --- Setup lines ---
            "never played nobody for a fool",
            "graduated from the school",
            "diamond in the rough a jewel",
            "break every single rule",
            "keeping it cool like a swimming pool",
            "old school but the new school fuel",
            "golden rule i'm no fool",
            "sharp as a tool",
            "crown jewel of the school",
            "whirlpool in the carpool",
            "cesspool to the vestibule",
            "molecule of the ridicule",
            "liverpool to the toadstool",
            "overrule the minuscule",
            "barstool at the kiddie pool",
            "istanbul is beautiful",
            "preschool to the high school fuel",
            "spool of the gene pool",
            "stool pigeon or the crown jewel",
            "retool the ridicule",
        ],
        dark: [
            "played the fool in the whirlpool",
            "ghost school in the cesspool",
        ],
        aggressive: [
            "overrule the fool in the pool",
            "power tool breaks every rule",
        ],
    },

    // ========================================================================
    // 'ing' family — Martin Luther King, B.B. King, Stephen King
    // ========================================================================
    'ing': {
        all: [
            // --- Martin Luther King punchlines ---
            "had a dream like martin luther king",
            "i have a dream like the king",
            "civil rights champion the king",
            "marched for freedom martin luther king",
            "mountain top vision the king",
            "letter from a birmingham king",
            "peaceful warrior martin luther king",
            "free at last martin luther king",
            // --- B.B. King punchlines ---
            "blues guitar legend b.b. king",
            "thrill is gone like b.b. king",
            "lucille crying b.b. king",
            // --- Stephen King punchlines ---
            "horror stories stephen king",
            "it came from the mind of stephen king",
            "shining bright like stephen king",
            "pennywise couldn't match this king",
            // --- Don King punchlines ---
            "only in america don king",
            "promoted greatness don king",
            // --- Elvis punchlines ---
            "the king of everything like elvis with the ring",
            "jailhouse rock and i'm the king",
            "can't help falling in love the king",
            // --- Steph Curry punchlines ---
            "three-point king with the ring steph curry swing",
            "night night celebration ring curry is the king",
            // --- Floyd Mayweather punchlines ---
            "fifty-o record in the ring mayweather is the king",
            "money fight in the ring mayweather bling",
            // --- Setup lines ---
            "freedom is the most beautiful thing",
            "hear the people sing and the bell ring",
            "diamond studded with the bling",
            "puppet master pull the string",
            "everything i do makes the phone ring",
            "spread my wings i can do anything",
            "from the bottom to the top of everything",
            "lion heart hear me roar like a king",
            "championship ring on my pinky ring",
            "i bring the heat feel the sting",
            "butterflies and the bee sting",
            "wedding ring or the boxing ring",
            "do my thing and let it swing",
            "offering for the gathering",
            "suffering and the reckoning",
            "handspring to the offspring",
            "hamstring on the g-string fling",
            "shoestring to the heartstring sing",
            "I turned nothing into everything",
            "pull the drawstring let the rhythm swing",
            "from the wellspring of an inner spring",
            "offspring of the mainspring swing",
        ],
        dark: [
            "dark wings spreading everything",
            "cold world doesn't mean a thing",
            "raven's wing and the suffering",
            "death's sting and the reckoning",
        ],
        aggressive: [
            "haymaker swing in the ring",
            "wrecking everything like a king",
            "scorpion sting do my thing",
        ],
    },

    // ========================================================================
    // 'ar' family — Kendrick Lamar
    // ========================================================================
    'ar': {
        all: [
            // --- Kendrick Lamar punchlines ---
            "lyrical genius kendrick lamar",
            "humble and sit down kendrick lamar",
            "dna in every bar kendrick lamar",
            "alright we gon' be alright kendrick lamar",
            "swimming pools and pulitzer kendrick lamar",
            "good kid mad city kendrick lamar",
            "king kunta like kendrick lamar",
            "damn right i'm kendrick lamar",
            "loyalty and royalty kendrick lamar",
            "element in every bar kendrick lamar",
            "money trees like kendrick lamar",
            "maad city madness kendrick lamar",
            "not like us kendrick lamar",
            // --- Bruno Mars punchlines ---
            "24k magic at the bar bruno mars superstar",
            "uptown funk you up bruno mars avatar",
            "locked out of heaven bruno mars guitar",
            // --- Kevin Durant punchlines ---
            "easy money sniper far kevin durant superstar",
            "slim reaper at the bar kevin durant",
            // --- Setup lines ---
            "raising the bar like a superstar",
            "shine bright like a shooting star",
            "no matter where you are near or far",
            "battle scar on every bar",
            "cigar in a sports car avatar",
            "writing memoirs from the reservoir",
            "boulevard of the stars",
            "golden guitar at the bazaar",
            "five-star general at the bar",
            "riding shotgun in the avatar",
            "seminar at the minibar",
            "similar to the particular",
            "popular regular spectacular",
            "radar on the handlebar",
            "rebar in the memoir guitar",
            "sidebar from the repertoire",
            "crowbar breaking every memoir",
            "lumbar support in the boxcar",
            "nectar far from the avatar",
            "registrar of the superstar",
        ],
        dark: [
            "battle scars darker than a jaguar",
            "shadows in the caviar",
            "cigar burns and the cold memoir",
            "bizarre how far the scars are",
        ],
        aggressive: [
            "waging war from the sports car",
            "crowbar justice avatar",
            "nuclear from afar superstar",
        ],
    },

    // ========================================================================
    // 'ames' family — LeBron James
    // ========================================================================
    'ames': {
        all: [
            // --- LeBron James punchlines ---
            "king of the court lebron james",
            "the chosen one lebron james",
            "championship rings lebron james",
            "witness greatness lebron james",
            "taking my talents lebron james",
            "more than a player lebron james",
            "goat status like lebron james",
            "i promise like lebron james",
            "decision maker lebron james",
            "kid from akron lebron james",
            // --- James Bond punchlines ---
            "shaken not stirred like the name james",
            "license to kill in the name of james",
            "007 running the games",
            // --- Game of Thrones punchlines ---
            "winter came and the thrones are flames",
            "iron throne power games",
            // --- Setup lines ---
            "hall of fame they know our names",
            "burning bridges and the flames",
            "playing all the right games",
            "staking all our claims",
            "picture frames and the halls of fame",
            "rise to fame through the flames",
            "fortune and the frames of fame",
            "no more blames just the flames and the games",
            "video games to the bigger aims",
            "overclaims and the counterclaims",
            "disclaims from the mainframes",
            "nicknames and the acclaim names",
            "boardgames to the end-game flames",
        ],
        dark: [
            "dark flames burning our names",
            "lost in the mind games",
            "blame games in the cold flames",
        ],
        aggressive: [
            "hunger games and the war flames",
            "no disclaims just the war games",
        ],
    },

    // ========================================================================
    // 'oose' family — Tom Cruise
    // ========================================================================
    'oose': {
        all: [
            // --- Tom Cruise punchlines ---
            "mission impossible tom cruise",
            "top gun flying high tom cruise",
            "risky business like tom cruise",
            "jerry maguire show me the money tom cruise",
            "maverick in the game tom cruise",
            "need for speed like tom cruise",
            "edge of tomorrow tom cruise",
            "last samurai tom cruise",
            "minority report on the loose tom cruise",
            // --- Gin and Juice (song) punchlines ---
            "sippin' on gin and juice",
            "laid back with the juice",
            "snoop doggy dogg gin and juice",
            // --- Ludacris punchlines ---
            "move get out the way on the loose ludacris",
            "number one spot no excuse ludacris produce",
            // --- Setup lines ---
            "nothing left for me to lose",
            "light the fuse and let it loose",
            "fresh-squeezed no excuse",
            "turning lemons into juice",
            "cut me loose no more abuse",
            "tighten up the noose or cut it loose",
            "on the loose like a mongoose",
            "golden goose producing juice",
            "introduce the truth no truce",
            "recluse in the caboose",
            "chartreuse on the vamoose",
            "produce the moose from the spruce",
            "footloose and the calaboose",
            "goose on the loose with the juice",
            "obtuse excuse from the recluse",
            "deduce the truce and reproduce",
        ],
        dark: [
            "noose around the truth no excuse",
            "nothing left to lose or to choose",
            "caboose of the recluse abuse",
        ],
        aggressive: [
            "let loose the dogs and the mongoose",
            "fast and loose with the short fuse",
        ],
    },

    // ========================================================================
    // 'ight' family — Mike Tyson, Suge Knight, Gladys Knight
    // ========================================================================
    'ight': {
        all: [
            // --- Mike Tyson punchlines ---
            "knockout punch like mike tyson in a fight",
            "iron mike step in the ring for the fight",
            "baddest man alive that's mike the fight",
            "undisputed heavyweight for the fight",
            "everybody has a plan til they fight mike for the night",
            // --- Suge Knight punchlines ---
            "death row running through the night",
            "red suit dangerous suge knight",
            // --- Gladys Knight punchlines ---
            "midnight train like gladys knight",
            "empress of soul gladys knight",
            "neither one of us gladys knight",
            // --- Conor McGregor punchlines ---
            "notorious left hand goodnight mcgregor in the fight",
            "mystic mac predicted the fight conor in the light",
            // --- Dark Knight (movie) punchlines ---
            "why so serious in the dark knight",
            "hero or villain in the dark knight",
            "gotham city trembles tonight dark knight",
            // --- John Wick punchlines ---
            "pencil through the night john wick in sight",
            "continental rules hold tight john wick flight",
            // --- Setup lines ---
            "shining in the spotlight every night",
            "never giving up without a fight",
            "moonlight streaming through the night",
            "rising up and burning bright",
            "satellite beaming in the night",
            "dynamite ignite the light",
            "hold on tight through the fright",
            "standing at the height of every fight",
            "wrong or right i'll fight all night",
            "oversight to the foresight",
            "left and right with all my might",
            "copyright on the hindsight",
            "flashlight in the dead of night",
            "birthright and the second sight",
            "limelight spotlight center stage tonight",
            "kryptonite in the starlight",
            "fahrenheit at the height of flight",
            "meteorite burning through the night",
            "playwright of the oversight",
            "polite despite the oversight",
            "fortnight in the neon light",
            "midnight twilight candlelight",
            "outright upright and forthright",
            "appetite for the parasite fight",
        ],
        dark: [
            "shadows dancing in the firelight",
            "endless night with no flashlight",
            "frostbite in the dead of night",
            "gunfight in the pale moonlight",
            "blight on the city tonight",
        ],
        aggressive: [
            "dogfight to the death tonight",
            "ignite dynamite in the firefight",
            "smite with all my might tonight",
            "prizefight with the oversight",
        ],
    },

    // ========================================================================
    // 'eal' family — Shaquille O'Neal
    // ========================================================================
    'eal': {
        all: [
            // --- Shaquille O'Neal punchlines ---
            "dominant force shaquille o'neal",
            "diesel power shaquille o'neal",
            "shaq attack for real o'neal",
            "kazaam magic shaquille o'neal",
            "four rings heavy shaquille o'neal",
            "free throw miss but still the deal shaquille o'neal",
            "center of attention shaquille o'neal",
            "shaq diesel for the mass appeal o'neal",
            // --- Lucille Ball punchlines ---
            "comedy queen with the reel appeal",
            "i love lucy keeping it real",
            // --- Wheel of Fortune punchlines ---
            "spin the wheel of fortune feel the deal",
            "big money on the wheel for real",
            // --- Setup lines ---
            "making every single move for real",
            "nothing in this world can make me kneel",
            "heart of steel behind the wheel",
            "raw deal but i'll never squeal",
            "keeping it real with mass appeal",
            "diamond in the rough reveal",
            "ideal life that i can feel",
            "battlefield behind the shield",
            "signed and sealed the deal is real",
            "peel back the layers i reveal",
            "cartwheel on the commonweal",
            "automobile on the pinwheel",
            "oatmeal on the treadmill zeal",
            "surreal ordeal on the appeal",
            "banana peel on the ordeal",
            "cornmeal of the sex appeal",
            "newsreel of the ordeal heal",
            "cockatiel on the ferris wheel",
        ],
        dark: [
            "wounds that time won't heal",
            "cold as steel and nothing's real",
            "achilles heel on the ordeal",
            "unreal how quickly wounds can heal",
        ],
        aggressive: [
            "ironclad and steel for the ordeal",
            "break the seal and make them kneel",
        ],
    },

    // ========================================================================
    // 'ame' family — Hall of Fame references
    // ========================================================================
    'ame': {
        all: [
            // --- Hall of Fame / Fame punchlines ---
            "immortalized in the hall of fame",
            "legacy written in a frame of fame",
            "remember the name remember the flame",
            "they'll never be the same",
            "hall of fame or hall of shame",
            // --- Michael Jordan punchlines ---
            "six rings changed the game michael jordan's flame",
            "space jam legendary name michael jordan in the frame",
            "air jordan flew the fame",
            // --- Kobe Bryant punchlines ---
            "mamba forever remember the name kobe's flame",
            "eighty-one points in the game kobe no shame",
            // --- Breaking Bad punchlines ---
            "say my name heisenberg's claim to fame",
            "i am the one who knocks the game breaking bad became",
            // --- Setup lines ---
            "i changed the game and the whole frame",
            "staked my claim lit the flame",
            "overcame every obstacle they came",
            "fortune and fame isn't just a game",
            "no one else to blame",
            "nickname became a brand name",
            "set the mainframe ablaze no shame",
            "endgame the fame and the name",
            "surname became a brand name",
            "domain of the flame and the claim",
            "timeframe on the picture frame",
            "untame the wild flame of the game",
            "overcame the counterclaim",
            "picture frame of the aflame",
            "ballgame to the endgame name",
            "boardgame to the domain flame",
        ],
        dark: [
            "shame and the blame set aflame",
            "dark flame of the counterclaim",
        ],
        aggressive: [
            "hostile takeover of the game",
            "inflame and reclaim the name",
        ],
    },

    // ========================================================================
    // 'an' family — Jackie Chan, Stan (Eminem), Batman, Superman
    // ========================================================================
    'an': {
        all: [
            // --- Jackie Chan punchlines ---
            "kick it hard like jackie chan",
            "rush hour stunts like jackie chan",
            "rumble in the bronx jackie chan",
            "drunken master jackie chan",
            "kung fu legend jackie chan",
            "police story action plan jackie chan",
            // --- Stan (Eminem song) punchlines ---
            "dear slim i wrote you like stan",
            "biggest fan in the world like stan",
            "obsessed with the plan like stan",
            // --- Batman punchlines ---
            "dark knight of the city batman",
            "gotham's hero that's batman",
            "no superpowers needed batman",
            "the bat signal in the gotham span batman",
            // --- Superman punchlines ---
            "faster than a bullet superman",
            "cape and shield superman",
            "man of steel superman",
            "krypton's finest superman",
            // --- Busta Rhymes punchlines ---
            "break ya neck on command busta rhymes the man",
            "dangerous with the plan busta rhymes in the van",
            "flipmode on demand busta rhymes the man",
            // --- Arnold Schwarzenegger punchlines ---
            "i'll be back with the plan schwarzenegger the man",
            "predator scan with the plan schwarzenegger clan",
            "terminator one-man clan schwarzenegger span",
            // --- Setup lines ---
            "executing every plan",
            "rise up be a better man",
            "understand the master plan",
            "caravan across the span",
            "contraband in the garbage can",
            "businessman gentleman with a plan",
            "do the best i can",
            "started as a one-man clan",
            "bigger than the boogeyman",
            "prove to them i can",
            "talisman of the promised land",
            "catamaran across the sand",
            "partisan of the caravan",
            "afghanistan to pakistan began",
            "overran the middleman",
            "spiderman in the minivan",
            "ombudsman for the working man",
            "handyman and the bogeyman",
            "also-ran to the frontline plan",
            "rattan fan from the garbage can",
        ],
        dark: [
            "dark side of the masterplan",
            "shadows longer than a wingspan",
            "hitman on the promised land",
            "deadpan in the garbage can",
        ],
        aggressive: [
            "battering ram in the masterplan",
            "strongman crush the middleman",
            "warplan overran the clan",
        ],
    },

    // ========================================================================
    // 'ill' family — Meek Mill, Lauryn Hill
    // ========================================================================
    'ill': {
        all: [
            // --- Meek Mill punchlines ---
            "dreams and nightmares meek mill",
            "going bad like meek mill",
            "championship feeling meek mill",
            "ima boss like meek mill",
            "litty like a committee meek mill",
            "cold hearted like meek mill",
            "blue notes for the thrill meek mill",
            // --- Lauryn Hill punchlines ---
            "miseducation like lauryn hill",
            "killing me softly lauryn hill",
            "everything is everything lauryn hill",
            "doo wop that thing lauryn hill",
            "that thing still lauryn hill",
            "ex-factor chills lauryn hill",
            // --- Cypress Hill punchlines ---
            "insane in the brain cypress hill",
            "hits from the bong cypress hill",
            // --- Gunna punchlines ---
            "drip or drown the skill gunna chill",
            "pushing p for the thrill gunna still",
            // --- Setup lines ---
            "climbing up the hill for the thrill",
            "iron will and a diamond drill",
            "overkill with the lyrical skill",
            "fulfill the will until the chill",
            "grinding uphill against my will",
            "stand still but i never will",
            "windmill goodwill treadmill",
            "blood spill on the windowsill",
            "refill the thrill no standing still",
            "downhill but i never stand still",
            "landfill to the overfill skill",
            "anthill and the chlorophyll",
            "foothill to the capitol hill",
            "daffodil on the windowsill chill",
            "distill and instill the skill",
            "roadkill to the overkill",
            "sawmill to the windmill drill",
            "goodwill and the free will thrill",
        ],
        dark: [
            "bitter pill on the windowsill",
            "kill or be killed on the hill",
            "overkill and the bitter pill",
            "roadkill on the downhill spill",
        ],
        aggressive: [
            "overkill in the battle drill",
            "kill at will uphill with skill",
            "drill sergeant on the hill",
        ],
    },

    // ========================================================================
    // 'ool' family additions — Cool, School references
    // ========================================================================

    // ========================================================================
    // 'em' family — Eminem
    // ========================================================================
    'em': {
        all: [
            // --- Eminem punchlines ---
            "slim shady that's eminem",
            "lose yourself like eminem",
            "rap god mode eminem",
            "stan wrote a letter to eminem",
            "without me there's no eminem",
            "8 mile road eminem",
            "real slim shady eminem",
            "cleaning out my closet eminem",
            "not afraid anymore eminem",
            "love the way you lie eminem",
            "venom in the system eminem",
            "mockingbird singing eminem",
            "till i collapse eminem",
            "when i'm gone remember eminem",
            "godzilla speed eminem",
            "killshot aim eminem",
            "the way i am eminem",
            // --- Setup lines ---
            "every one of them and all of them",
            "precious like a gem",
            "cut the stem and watch 'em condemn",
            "requiem for the stratagem",
            "anthem of the diadem",
            "problem in the system stem",
            "paradigm shift in the rhythm",
            "condemn the mayhem and the phlegm",
            "theorem from the stratagem",
            "jerusalem to bethlehem",
            "chrysanthemum and the diadem",
            "tandem in the pandemonium stem",
            "modem of the modern totem",
            "emblem of the ad hominem",
        ],
        dark: [
            "venom in the requiem",
            "condemned by the stratagem",
        ],
        aggressive: [
            "mayhem from the diadem",
            "condemn and overwhelm",
        ],
    },

    // ========================================================================
    // 'oop' family — Snoop Dogg
    // ========================================================================
    'oop': {
        all: [
            // --- Snoop Dogg punchlines ---
            "drop it like it's hot snoop",
            "gin and juice with snoop",
            "d-o-double-g that's snoop",
            "nuthin' but a g thang snoop",
            "beautiful morning with snoop",
            "who am i it's snoop",
            "the next episode with snoop",
            "lodi dodi we likes to party snoop",
            "doggy style through the loop snoop",
            "serial chiller in the group snoop",
            // --- Setup lines ---
            "running in a loop",
            "slam dunk through the hoop",
            "troop by troop we regroup",
            "scoop the truth from the group",
            "swoop in like a paratrooper troop",
            "chicken coop to the penthouse group",
            "alley-oop to the basketball hoop",
            "loop-de-loop in the coop",
            "trooper in the super group",
            "droop and swoop in the ninety-proof",
            "cantaloupe on the tightrope loop",
            "hula hoop in the troop scoop",
        ],
        dark: [
            "loophole in the noose and the droop",
            "downward swoop from the rooftop scoop",
        ],
    },

    // ========================================================================
    // 'ay' family — Dr. Dre, Beyoncé
    // ========================================================================
    'ay': {
        all: [
            // --- Dr. Dre punchlines ---
            "forgot about them like dre",
            "west coast legend that's dre",
            "still reppin' compton dre",
            "the chronic bumpin' dre",
            "nuthin' but a g thang dre",
            "next episode with dre",
            "beats by dre all day",
            "aftermath empire dre",
            "i need a doctor like dre",
            "deep cover from the bay dre",
            // --- Beyoncé punchlines ---
            "irreplaceable like beyonce",
            "run the world like beyonce",
            "lemonade sipping beyonce",
            "crazy in love like beyonce",
            "single ladies beyonce",
            "formation standing like beyonce",
            "drunk in love like beyonce",
            "flawless every way beyonce",
            "halo shining bright beyonce",
            "who run the world beyonce all day",
            "texas hold 'em winning beyonce",
            "break my soul every day beyonce",
            // --- Marvin Gaye punchlines ---
            "what's going on today marvin gaye",
            "let's get it on all day marvin gaye",
            "mercy mercy me marvin gaye",
            // --- Doja Cat punchlines ---
            "say so every day doja cat in the way",
            "streets say doja cat rules the day",
            // --- Family Feud / Steve Harvey punchlines ---
            "survey says i win the day steve harvey hooray",
            "family feud top answer on display",
            // --- Setup lines ---
            "grind all night and shine all day",
            "paving my own way today",
            "never letting them get in the way",
            "born to lead and not obey",
            "here to stay come what may",
            "seize the day in every way",
            "holiday on the getaway",
            "making hay while the sun's at play",
            "broadway to the highway all the way",
            "stowaway on the runaway",
            "castaway on the waterway",
            "ricochet on the halfway",
            "resume the passageway",
            "protege on the getaway",
            "matinee in the cabaret",
            "negligee on the resume",
            "fiance in the entryway",
            "cliche in the alleyway",
            "buffet at the halfway relay",
            "bouquet on the holiday bay",
        ],
        dark: [
            "doomsday in the alleyway",
            "mayday mayday no escape today",
            "decay and the disarray",
        ],
        aggressive: [
            "melee in the getaway bay",
            "outweigh and outplay all day",
            "slay the competition today",
        ],
    },

    // ========================================================================
    // 'ace' family — Scarface, Ghostface Killah
    // ========================================================================
    'ace': {
        all: [
            // --- Scarface (movie) punchlines ---
            "say hello to my little friend scarface",
            "the world is mine like scarface",
            "money power respect scarface",
            "tony montana that's scarface",
            "kingpin of the palace scarface",
            // --- Scarface (rapper) punchlines ---
            "geto boys legend scarface",
            "mind playing tricks scarface",
            // --- Ghostface Killah punchlines ---
            "wu-tang sword style ghostface",
            "ironman from the staircase ghostface",
            "supreme clientele ghostface",
            "fishscale from the staircase ghostface",
            // --- Usain Bolt punchlines ---
            "world record pace usain bolt in the race",
            "lightning in the sprint race usain bolt embrace",
            // --- Avengers punchlines ---
            "assembled in the workspace avengers at the base",
            "endgame on the fireplace avengers saving the place",
            // --- Setup lines ---
            "running through the rat race",
            "leaving no trace in the marketplace",
            "disgrace or grace it's a commonplace",
            "first place in the arms race",
            "can't erase the look on my face",
            "replaced the interface",
            "birthplace to the workplace",
            "aerospace to the database",
            "shoelace in the staircase",
            "embrace the marketplace",
            "typeface on the suitcase",
            "briefcase on the bookcase",
            "palace to the terrace",
            "necklace on the surface",
            "fireplace in the commonplace",
            "pillowcase for the basket case",
            "showcase in the anyplace space",
            "misplace the interlace",
        ],
        dark: [
            "poker face in a dark place",
            "cold embrace in the staircase",
            "defaced in the marketplace",
        ],
        aggressive: [
            "straight to your face no disgrace",
            "warface in the marketplace",
            "outpace and deface the race",
        ],
    },

    // ========================================================================
    // 'iller' family — Thriller (Michael Jackson), Mac Miller
    // ========================================================================
    'iller': {
        all: [
            // --- Thriller (song) punchlines ---
            "thriller night and i'm the killer",
            "cuz this is thriller no one's iller",
            "zombie dance floor thriller",
            "vincent price voice on the thriller",
            // --- Mac Miller punchlines ---
            "self care vibes mac miller",
            "swimming through the life mac miller",
            "blue world dreaming mac miller",
            "best day ever mac miller",
            "the divine feminine mac miller",
            "donald trump money mac miller",
            "good news forever mac miller",
            // --- Wiz Khalifa punchlines ---
            "see you again a real thriller wiz khalifa",
            "black and yellow caterpillar wiz khalifa",
            // --- Setup lines ---
            "natural born killer",
            "caterpillar to a gorilla",
            "vanilla ice couldn't be iller",
            "painkiller for the bitter",
            "no filler every bar is killer",
            "guerrilla warfare no vanilla",
            "chinchilla coat and the killer instinct",
            "distiller of the gorilla thriller",
            "driller on the caterpillar",
            "vanilla gorilla pillar",
            "manila folder painkiller",
            "tequila with the chinchilla thriller",
            "fulfiller of the pillar killer",
            "guerrilla style painkiller",
        ],
        dark: [
            "serial killer in the thriller",
            "painkiller for the bitter pillar",
        ],
        aggressive: [
            "gorilla warfare killer instinct",
            "natural born killer no filler",
        ],
    },

    // ========================================================================
    // 'ize' family — Hypnotize (Biggie), various -ize references
    // ========================================================================
    'ize': {
        all: [
            // --- Hypnotize (song) punchlines ---
            "biggie smalls hypnotize",
            "notorious with the hypnotize",
            "ten crack commandments i memorize",
            "juicy was the dream we realize",
            "big poppa recognized",
            "mo money mo problems no surprise",
            "sky's the limit for the wise biggie hypnotize",
            "warning shots that paralyze biggie on the rise",
            // --- Jimi Hendrix punchlines ---
            "purple haze in my eyes jimi hendrix improvise",
            "voodoo child mesmerize jimi hendrix on the rise",
            // --- Doja Cat punchlines ---
            "say so and the world hypnotize doja cat on the rise",
            "woman of the enterprise doja cat capitalize",
            // --- Megan Thee Stallion punchlines ---
            "hot girl summer in disguise megan on the rise",
            "savage body energize megan thee stallion capitalize",
            // --- Setup lines ---
            "open up your eyes and realize",
            "revolutionize and capitalize",
            "no disguise when i improvise",
            "weaponize the enterprise",
            "monopolize then prioritize",
            "mesmerize when i harmonize",
            "visualize then materialize",
            "energize and i'll supervise",
            "ostracize the compromise",
            "galvanize and cauterize",
            "exorcize the paralyze",
            "tantalize and improvise",
            "authorize the enterprise",
            "finalize and crystallize",
            "jeopardize the compromise",
            "subsidize the merchandise",
            "otherwise i'll improvise",
            "terrorize and pulverize",
            "maximize and minimize the lies",
            "paradise behind my eyes",
            "exercise and exorcize",
            "analyze and harmonize",
        ],
        dark: [
            "traumatize until they paralyze",
            "cold eyes that hypothesize",
            "agonize in the compromise",
        ],
        aggressive: [
            "pulverize and ostracize",
            "neutralize the enterprise",
            "brutalize and terrorize",
        ],
    },

    // ========================================================================
    // 'eam' family — C.R.E.A.M. (Wu-Tang), Kareem Abdul-Jabbar
    // ========================================================================
    'eam': {
        all: [
            // --- C.R.E.A.M. (song) punchlines ---
            "cash rules everything cream",
            "dollar dollar bill y'all cream",
            "wu-tang forever living the dream",
            "protect ya neck upstream",
            "wu-tang ain't nothing to scheme with cream",
            // --- Kareem Abdul-Jabbar punchlines ---
            "skyhook legend kareem",
            "all-time scorer kareem",
            "game of death with kareem",
            "six mvps on the supreme kareem",
            // --- Inception (movie) punchlines ---
            "dream within a dream like inception supreme",
            "deeper levels of the dream inception scheme",
            // --- Kobe Bryant punchlines ---
            "mamba mentality in the dream kobe supreme",
            "twenty-four seven on the team kobe's dream",
            // --- Setup lines ---
            "chasing the american dream",
            "living in the mainstream",
            "building up a head of steam",
            "supreme team on the extreme",
            "moonbeam sunbeam self-esteem",
            "ice cream scheme on the dream team",
            "daydream downstream it would seem",
            "bloodstream to the jetstream",
            "scream upstream in the mainstream",
            "airstream to the pipe dream",
            "regime of the supreme extreme",
            "blaspheme in the mainstream beam",
            "esteem from the downstream stream",
            "redeem the pipe dream and the scheme",
            "midstream of the laser beam",
            "downstream of the jet stream gleam",
        ],
        dark: [
            "nightmare dressed like a daydream",
            "silent scream in the bloodstream",
        ],
        aggressive: [
            "war regime on the extreme",
            "battle scream in the mainstream",
        ],
    },

    // ========================================================================
    // 'it' family — Brad Pitt
    // ========================================================================
    'it': {
        all: [
            // --- Brad Pitt punchlines ---
            "looking clean like brad pitt",
            "fight club with brad pitt",
            "mr and mrs smith brad pitt",
            "ocean's eleven brad pitt",
            "troy warrior brad pitt",
            "snatch moves from brad pitt",
            // --- Lil Baby punchlines ---
            "drip too hard every bit lil baby legit",
            "my turn to spit lil baby never quit",
            // --- 21 Savage punchlines ---
            "a lot on my mind spit 21 savage legit",
            "bank account stacking every bit 21 savage hit",
            // --- Setup lines ---
            "everything i do is legit",
            "certified hit after hit",
            "grit and wit never quit",
            "counterfeit? nah this is it",
            "benefit from every bit",
            "admit i'm the ultimate",
            "spit bars that's a perfect fit",
            "permit the transmit commit",
            "exhibit the explicit wit",
            "retrofit the outfit legit",
            "acquit and recommit",
            "unfit to the outfit summit",
            "bedsit to the pulpit spit",
            "armpit to the cockpit lit",
            "moonlit with the permit spit",
            "bandit in the cockpit legit",
            "implicit in the explicit hit",
        ],
        dark: [
            "bottomless pit and the unfit",
            "dimly lit in the counterfeit",
        ],
        aggressive: [
            "tomahawk hit and never quit",
            "heavyweight bout legit",
        ],
    },

    // ========================================================================
    // 'ast' family — references
    // ========================================================================
    'ast': {
        all: [
            // --- Fast and Furious punchlines ---
            "family first fast and furious to the last",
            "live life a quarter mile fast",
            "ride or die from the past",
            "dom toretto family that will last",
            // --- Outkast punchlines ---
            "stankonia shaking the forecast outkast",
            "hey ya blasting from the past outkast",
            "southernplayalistic the broadcast outkast",
            // --- Setup lines ---
            "moving too fast for the broadcast",
            "holding on steadfast to the mast",
            "iconoclast from the past",
            "outcast outlast typecast forecast",
            "blast from the past and the contrast",
            "overcast on the downcast mast",
            "enthusiast with the steadfast",
            "gymnast on the simulcast",
            "newscast from the podcast past",
            "sandblast through the overcast",
            "flabbergast at the enthusiast",
            "half-mast to the full-mast fast",
            "lambast the typecast outcast",
        ],
        dark: [
            "ghost of the past and the downcast",
            "forecast of the overcast blast",
        ],
        aggressive: [
            "bombblast and the sandblast fast",
            "lambast every typecast outcast",
        ],
    },

    // ========================================================================
    // 'ex' family — DMX
    // ========================================================================
    'ex': {
        all: [
            // --- DMX punchlines ---
            "x gon' give it to ya dmx",
            "ruff ryders anthem dmx",
            "party up in here dmx",
            "lord give me a sign dmx",
            "where the hood at dmx",
            "slippin' but i'm getting up dmx",
            "prayer then the flex dmx",
            "rough rider complex dmx",
            // --- T.I. punchlines ---
            "whatever you like what's next t.i. flex",
            "rubber band man complex t.i. the apex",
            // --- Setup lines ---
            "flex on every complex",
            "next level apex",
            "t-rex in the duplex",
            "perplex the reflex",
            "annex the index and the specs",
            "writing checks and the effects",
            "context of the pretext flex",
            "vortex in the latex complex",
            "cortex of the index apex",
            "spandex on the reflex hex",
            "complex multiplex annex",
            "convex of the apex flex",
            "latex on the rolodex",
        ],
        dark: [
            "hex on the complex vortex",
            "death reflex in the duplex",
        ],
        aggressive: [
            "flex and annex the apex",
            "power complex to perplex",
        ],
    },

    // ========================================================================
    // MOVIE / TV PUNCHLINES — organized by rhyme family
    // ========================================================================

    // 'ire' family — Empire, The Wire
    'ire': {
        all: [
            "building my empire higher and higher",
            "game of thrones sitting by the fire",
            "the wire taught me to conspire",
            "walking through the fire never tire",
            "empire state my heart's desire",
            "never retire just inspire",
            "funeral pyre of the empire",
            "set the world on fire",
            "bonfire under the spire",
            "crossfire in the quagmire",
            "high wire over the hellfire",
            "transpire and perspire",
            "ceasefire from the vampire",
            "satire of the choir",
            "misfire from the empire",
            "barbed wire on the foxfire",
            "campfire stories that transpire",
            "require the empire to conspire",
        ],
        dark: [
            "hellfire from the vampire",
            "funeral pyre set the world on fire",
        ],
        aggressive: [
            "rapid-fire from the crossfire",
            "friendly fire from the empire",
        ],
    },

    // 'ade' family — movies, celebrities
    'ade': {
        all: [
            "django unchained and the crusade",
            "blockade running like a renegade",
            "masquerade at the parade",
            "homemade blueprint self-made",
            // --- Sade punchlines ---
            "smooth operator like sade in the shade",
            "your love is king the accolade sade",
            // --- Kevin Durant punchlines ---
            "slim reaper with the blade durant made",
            "easy money never fade kevin durant grade",
            // --- Nipsey Hussle punchlines ---
            "marathon running don't fade nipsey hussle parade",
            "victory lap in the shade nipsey never afraid",
            // --- Movie references ---
            "the godfather plans are laid",
            "matrix bullet time evade cascade",
            // --- Setup lines ---
            "renegade of the arcade",
            "barricade in the everglades",
            "lemonade from the hand grenade",
            "marmalade and the escapade",
            "cavalcade down the promenade",
            "retrograde but i'm unafraid",
            "accolade from the stock in trade",
            "cannonade on the barricade",
            "fusillade of the handmade upgrade",
            "stockade to the colonnade",
            "serenade at the masquerade",
            "motorcade through the arcade",
            "handmade upgrade never downgrade",
            "tirade of the crusade parade",
            "ambuscade in the colonnade",
            "switchblade on the promenade",
            "cascade of the accolade grade",
        ],
        dark: [
            "nightshade on the razor blade",
            "shallow grave that the darkness made",
            "betrayed in the renegade",
        ],
        aggressive: [
            "switchblade crusade and the hand grenade",
            "ambuscade of the cannonade",
            "invade the blockade unafraid",
        ],
    },

    // 'ound' family
    'ound': {
        all: [
            "twelve rounds and i'm still around",
            "pound for pound the most profound",
            "underground to the foreground",
            "lost and found on the battleground",
            "surround sound from the underground",
            // --- Floyd Mayweather punchlines ---
            "undefeated every round floyd mayweather pound for pound",
            "money team rebound mayweather never on the ground",
            // --- Steph Curry punchlines ---
            "three from downtown resound steph curry rebound",
            "splash brother sound steph curry on the mound",
            // --- Movie references ---
            "fight club first round on the ground",
            "inception dream levels compound and rebound",
            // --- Setup lines ---
            "playground to the proving ground",
            "background of the foreground sound",
            "bloodhound on the compound ground",
            "fairground to the stomping ground",
            "runaround on the turnaround mound",
            "greyhound on the dumbfound",
            "spellbound by the sound around",
            "outbound from the homebound",
            "newfound on the campground",
            "earthbound to the skybound",
            "housebound in the background",
            "rebound from the dumbfound",
            "merry-go-round on the playground",
            "snowbound on the common ground",
            "westbound on the homebound",
        ],
        dark: [
            "buried underground never to be found",
            "cold ground where the bodies are found",
        ],
        aggressive: [
            "pounding ground shaking pound for pound",
            "hunting ground where the prey is found",
        ],
    },

    // ========================================================================
    // GAME SHOW & TV HOST PUNCHLINES
    // ========================================================================

    // Game shows are scattered across families based on their host name rhymes
    // Chuck Woolery → 'oolery' (jewelry/foolery)
    // Bob Barker → 'arker' (darker/marker)
    // Steve Harvey → standalone phrases
    // Alex Trebek → 'eck' (check/deck)

    'arker': {
        all: [
            // --- Bob Barker punchlines ---
            "price is right come on down bob barker",
            "spay and neuter bob barker",
            "closest without going over bob barker",
            "plinko champion bob barker",
            "the price is right bob barker",
            "showcase showdown bob barker",
            // --- Peter Parker / Spider-Man punchlines ---
            "with great power peter parker",
            "web-slinger in the darker peter parker",
            "friendly neighborhood marker like parker",
            // --- Setup lines ---
            "streets getting darker",
            "left my marker",
            "sharper than a loan shark in the darker",
            "bookmarker to the hallmarker",
            "darker days couldn't be starker",
            "car parker to the loan sharker",
            "landmark on the benchmark marker",
            "trademark of the matriarch's marker",
        ],
        dark: [
            "night grows darker and starker",
            "cold-blooded like a loan sharker",
        ],
    },

    // ========================================================================
    // HISTORICAL ICON PUNCHLINES — mixed into relevant families above
    // ========================================================================

    // Additional historical punchlines in 'arks' family
    'arks': {
        all: [
            // --- Rosa Parks punchlines ---
            "took a seat like rosa parks",
            "wouldn't move like rosa parks",
            "front of the bus rosa parks",
            "civil rights sparked by rosa parks",
            "the mother of freedom rosa parks",
            // --- Jurassic Park punchlines ---
            "life finds a way jurassic parks",
            "dinosaurs in the theme parks",
            // --- Setup lines ---
            "left my marks like question marks",
            "swimming with the sharks",
            "lighting up the dark like sparks",
            "trademark remarks from the patriarch",
            "benchmarks and the watermarks",
            "landmarks after the remarks",
            "hallmarks of the patriarchs",
            "bookmarks on the question marks",
            "postmarks from the monarchs",
            "embarks on the hallmarks",
        ],
        dark: [
            "dark remarks from the oligarchs",
            "swimming with the midnight sharks",
        ],
    },

    // Karl Marx in 'arks' above too
    // Einstein in 'ine' family (already in RhymeEngine)

    // 'ind' family — Empire State of Mind (song)
    'ind': {
        all: [
            "empire state of mind",
            "concrete jungle where dreams are designed",
            "new york state of mind",
            "one of a kind with a brilliant mind",
            "leave the past behind",
            "mastermind with a one-track mind",
            "grind until i find",
            "read between the lines defined",
            "colorblind but the vision refined",
            "humankind intertwined and aligned",
            "peace of mind that i finally find",
            "undermined but i'm still refined",
            "mastermind of the undefined",
            "redesigned and realigned",
            "spellbind the unkind mankind",
            "unconfined by the daily grind",
        ],
        dark: [
            "losing my mind left behind",
            "darkness of the troubled mind",
        ],
        aggressive: [
            "undermine the mastermind",
            "grind until the walls unwind",
        ],
    },

    // 'ub' family — In Da Club (song)
    'ub': {
        all: [
            "go shorty it's your birthday in da club",
            "bottle poppin' in da club",
            "vip section in the club",
            "shutting down the club",
            "hands up in the club",
            "rub elbows in the hub",
            "bathtub money from the scrub",
            "nightclub to the sub",
            "hubby-dub in the club",
            "grub hub of the club",
        ],
        dark: [
            "cold blood in the nightclub hub",
            "bathtub full of the scrub and dub",
        ],
    },

    // 'un' family — Big Pun
    'un': {
        all: [
            // --- Big Pun punchlines ---
            "lyrical heavyweight big pun",
            "still not a player big pun",
            "twinz deep cover big pun",
            "capital punishment big pun",
            "dream shatterer big pun",
            "bronx legend big pun",
            // --- KRS-One punchlines ---
            "boogie down productions krs-one",
            "the bridge is over krs-one",
            "criminal minded krs-one",
            "edutainment from krs-one",
            // --- Pop Smoke punchlines ---
            "welcome to the party just begun pop smoke stun",
            "woo walk son pop smoke number one",
            // --- Lil Durk punchlines ---
            "voice of the streets second to none lil durk run",
            "all my life outrun lil durk won",
            // --- Setup lines ---
            "not afraid to be the chosen one",
            "number one under the sun",
            "loaded like a gun",
            "the job is never done",
            "victory has been won",
            "i outrun everyone under the sun",
            "second to none",
            "hit and run on the rerun",
            "homerun under the midnight sun",
            "skeleton in the skeleton run",
            "grandson of the outgun",
            "stepson on the marathon run",
            "overdone and undone son",
            "shotgun to the setting sun",
            "comparison to none under the sun",
            "phenomenon under the neon sun",
        ],
        dark: [
            "on the run from the loaded gun",
            "undone by the smoking gun",
        ],
        aggressive: [
            "outrun the shotgun under the sun",
            "number one with the smoking gun",
        ],
    },

    // ========================================================================
    // ADDITIONAL PUNCHLINES — Athletes, More Actors, More Musicians
    // ========================================================================

    // 'ose' family — Derrick Rose
    'ose': {
        all: [
            // --- Derrick Rose punchlines ---
            "mvp moves like derrick rose",
            "youngest mvp derrick rose",
            "i can't close my eyes derrick rose",
            "windy city legend derrick rose",
            // --- Axl Rose punchlines ---
            "welcome to the jungle axl rose",
            "sweet child of mine axl rose",
            "november rain axl rose",
            "patience running out axl rose",
            "paradise city axl rose",
            // --- Setup lines ---
            "untouchable from head to toes",
            "everybody knows how it goes",
            "strike a pose and watch it flows",
            "no one even comes close",
            "thorns on every rose",
            "decompose and then recompose",
            "from the highs to the lows",
            "primrose on the diagnose",
            "comatose but the legend grows",
            "grandiose with the dominoes",
            "lacrosse to the pantyhose",
            "overdose on the bellicose",
            "purpose and the verbose prose",
            "morose on the cellulose",
            "glucose of the virtuose",
            "juxtapose the highs and lows",
        ],
        dark: [
            "comatose and the overdose",
            "morose in the cellulose",
        ],
        aggressive: [
            "bulldoze through the dominoes",
            "decompose everything that oppose",
        ],
    },

    // 'aze' family additions
    'aze': {
        all: [
            "set the stage ablaze no phase",
            "amazing grace in a purple haze",
            "jimi hendrix purple haze",
            "lost in the maze of the craze",
            "blaze through the haze unfazed",
        ],
    },

    // 'ock' family additions — more movies
    'ock2': {
        all: [
            // --- Rocky (movie) punchlines ---
            "gonna fly now like rocky",
            "adrian! eye of the tiger rocky",
            // --- John Wick punchlines ---
            "pencil kills like john wick on the clock",
            // --- The Matrix punchlines ---
            "red pill blue pill in the matrix shock",
            "dodge bullets like neo in the matrix block",
        ],
    },

    // 'ade' family additions — Sade
    'ade2': {
        all: [
            // --- Sade punchlines ---
            "smooth operator like sade",
            "your love is king sade",
        ],
    },

    // ========================================================================
    // SONG TITLE PUNCHLINES — scattered across families
    // ========================================================================

    // Purple Rain in 'ain' family (above)
    // Thriller in 'iller' family (above)
    // Billie Jean in 'een' family (above)
    // Hypnotize in 'ize' family (above)
    // C.R.E.A.M. in 'eam' family (above)
    // Still D.R.E. in 'ay' family (above)
    // Empire State of Mind in 'ind' family (above)
    // Hotline Bling in 'ing' family:

    // Additional song references scattered:
    // Stan in 'an' family (above)
    // Lose Yourself — standalone
    // Changes — standalone
    // In Da Club in 'ub' family (above)

    // ========================================================================
    // TV / GAME SHOW PUNCHLINE TEMPLATES
    // ========================================================================
    'gameshow': {
        all: [
            // --- Chuck Woolery / Love Connection ---
            "made a love connection to the game chuck woolery",
            "two and two back after the break chuck woolery",
            "love connection and the jewelry like woolery",
            // --- Alex Trebek / Jeopardy ---
            "what is greatness alex trebek",
            "daily double like alex trebek",
            "final jeopardy alex trebek",
            "answer in the form of a check trebek",
            // --- Steve Harvey / Family Feud ---
            "survey says i'm number one steve harvey",
            "family feud and i won steve harvey",
            "good answer good answer steve harvey",
            "show me the money steve harvey",
            "kings of comedy steve harvey",
            // --- Bob Barker / Price is Right ---
            // (in 'arker' family above)
            // --- Pat Sajak / Wheel of Fortune ---
            "spin the wheel like pat sajak",
            "i'd like to solve the puzzle pat sajak",
            "buy a vowel pat sajak",
            // --- Regis Philbin / Who Wants to Be a Millionaire ---
            "final answer like regis philbin",
            "is that your final answer regis philbin",
            // --- Howie Mandel / Deal or No Deal ---
            "deal or no deal howie mandel",
            "open the case howie mandel",
            // --- Jerry Springer ---
            "final thought from jerry springer",
            "chair-throwing drama jerry springer",
            // --- Maury Povich ---
            "you are not the father maury povich",
            "the lie detector determined maury povich",
            // --- Judge Judy ---
            "objection overruled judge judy",
            "don't pee on my leg judge judy",
            // --- Oprah ---
            "you get a car like oprah",
            "everybody gets one oprah",
            "living your best life oprah",
            // --- Johnny Carson ---
            "heeere's johnny like carson",
            "tonight show legacy johnny carson",
            // --- Simon Cowell ---
            "that was absolutely dreadful simon cowell",
            "it's a yes from me simon cowell",
        ],
    },

    // ========================================================================
    // MORE ACTORS — scattered across families
    // ========================================================================
    'actor_misc': {
        all: [
            // --- Clint Eastwood (in 'ood' family) ---
            "do you feel lucky clint eastwood",
            "good bad ugly clint eastwood",
            "make my day like clint eastwood",
            "unforgiven like clint eastwood",
            // --- Arnold Schwarzenegger ---
            "i'll be back like schwarzenegger",
            "terminator mode schwarzenegger",
            "hasta la vista schwarzenegger",
            "get to the chopper schwarzenegger",
            // --- Bruce Willis ---
            "die hard never give up bruce willis",
            "yippee ki yay bruce willis",
            // --- Harrison Ford ---
            "indiana jones adventure harrison ford",
            "han solo flying through the stars ford",
            // --- Keanu Reeves ---
            "i know kung fu keanu reeves",
            "john wick mode keanu reeves",
            "chosen one the matrix keanu reeves",
            "excellent adventure keanu reeves",
            // --- Eddie Murphy ---
            "coming to america eddie murphy",
            "beverly hills cop eddie murphy",
            "raw and delirious eddie murphy",
            // --- Will Smith ---
            "fresh prince of the game will smith",
            "getting jiggy with it will smith",
            "men in black like will smith",
            "pursuit of happiness will smith",
            "legend status will smith",
            // --- Jamie Foxx ---
            "any given sunday jamie foxx",
            "django unchained jamie foxx",
            "ray charles story jamie foxx",
            // --- Kevin Hart ---
            "let me explain kevin hart",
            "think like a man kevin hart",
            "ride along in the fast lane kevin hart",
            // --- Jackie Chan (also in 'an' family) ---
            // --- Chuck Norris ---
            "roundhouse kick like chuck norris",
            "facts about chuck norris",
            "walker texas ranger chuck norris",
            // --- Liam Neeson ---
            "particular set of skills liam neeson",
            "i will find you liam neeson",
            "taken everything liam neeson",
            // --- Morgan Freeman ---
            "voice of god morgan freeman",
            "shawshank redemption morgan freeman",
            "driving miss daisy morgan freeman",
            // --- Robert De Niro ---
            "you talkin' to me de niro",
            "goodfellas legend de niro",
            "casino money de niro",
            "raging bull de niro",
            // --- Al Pacino ---
            "say hello to my little friend pacino",
            "godfather moves al pacino",
            "scarface empire al pacino",
            "scent of a woman al pacino",
            "hoo-ah like al pacino",
        ],
    },

    // ========================================================================
    // MORE ATHLETES — scattered
    // ========================================================================
    'athlete_misc': {
        all: [
            // --- Michael Jordan ---
            "six rings like michael jordan",
            "airness in the air michael jordan",
            "flu game legend michael jordan",
            "space jam dunk michael jordan",
            "greatest ever michael jordan",
            "be like mike michael jordan",
            // --- Kobe Bryant ---
            "mamba mentality kobe bryant",
            "twenty-four seven kobe bryant",
            "eighty-one points kobe bryant",
            "championship parade kobe bryant",
            "dear basketball kobe bryant",
            // --- Steph Curry ---
            "three-point splash steph curry",
            "night night and don't worry steph curry",
            "chef curry cooking up steph curry",
            // --- Floyd Mayweather ---
            "undefeated like floyd mayweather",
            "money team like floyd mayweather",
            "fifty and zero floyd mayweather",
            "tms money mayweather",
            // --- Usain Bolt ---
            "fastest man alive usain bolt",
            "lightning bolt to a jolt usain bolt",
            "world record hold usain bolt",
            // --- Conor McGregor ---
            "notorious like conor mcgregor",
            "i'd like to apologize to nobody mcgregor",
            // --- Allen Iverson ---
            "crossover king allen iverson",
            "practice we talkin' about practice iverson",
            "the answer is allen iverson",
            // --- Tom Brady ---
            "seven rings like tom brady",
            "greatest quarterback ever tom brady",
            "let's go the goat tom brady",
            // --- Serena Williams ---
            "grand slam queen serena williams",
            "twenty-three titles serena williams",
            "serve and volley serena williams",
            // --- Tiger Woods ---
            "masters champion tiger woods",
            "sunday red tiger woods",
            // --- Dennis Rodman ---
            "rebound king dennis rodman",
            "bad as i wanna be rodman",
            "worm on the floor rodman",
            // --- Bo Jackson ---
            "bo knows everything bo jackson",
            "two sport legend bo jackson",
        ],
    },

    // ========================================================================
    // MORE MUSICIANS — scattered
    // ========================================================================
    'musician_misc': {
        all: [
            // --- Prince ---
            "purple rain falling like prince",
            "when doves cry like prince",
            "party like it's 1999 prince",
            "little red corvette like prince",
            "kiss from prince",
            "raspberry beret prince",
            // --- Bob Marley ---
            "one love one heart bob marley",
            "three little birds bob marley",
            "redemption song bob marley",
            "no woman no cry bob marley",
            "buffalo soldier bob marley",
            "jamming to the beat bob marley",
            "get up stand up bob marley",
            // --- Stevie Wonder ---
            "superstition like stevie wonder",
            "isn't she lovely stevie wonder",
            "signed sealed delivered stevie wonder",
            "part-time lover stevie wonder",
            "i just called to say i love stevie wonder",
            // --- Jimi Hendrix ---
            "purple haze like jimi hendrix",
            "voodoo child jimi hendrix",
            "all along the watchtower hendrix",
            "are you experienced jimi hendrix",
            "star spangled banner hendrix",
            // --- Marvin Gaye ---
            "what's going on marvin gaye",
            "let's get it on marvin gaye",
            "sexual healing marvin gaye",
            "inner city blues marvin gaye",
            // --- Elvis Presley ---
            "the king of rock elvis presley",
            "jailhouse rock elvis presley",
            "suspicious minds elvis presley",
            "hound dog howling elvis presley",
            // --- Whitney Houston ---
            "i will always love you whitney houston",
            "greatest love of all whitney houston",
            "i wanna dance with somebody whitney houston",
            // --- Aretha Franklin ---
            "r-e-s-p-e-c-t aretha franklin",
            "natural woman aretha franklin",
            "queen of soul aretha franklin",
            // --- Frank Sinatra ---
            "my way every day frank sinatra",
            "fly me to the moon frank sinatra",
            "new york new york frank sinatra",
            // --- Freddie Mercury ---
            "bohemian rhapsody freddie mercury",
            "we are the champions freddie mercury",
            "don't stop me now freddie mercury",
            "another one bites the dust freddie mercury",
            // --- David Bowie ---
            "starman waiting david bowie",
            "ziggy stardust david bowie",
            "heroes just for one day bowie",
            "under pressure david bowie",
            "changes turn and face the strange bowie",
            // --- The Weeknd ---
            "blinding lights the weeknd",
            "can't feel my face the weeknd",
            "starboy shining bright the weeknd",
            "earned it all the weeknd",
            // --- Bruno Mars ---
            "uptown funk you up bruno mars",
            "just the way you are bruno mars",
            "24k magic bruno mars",
            "locked out of heaven bruno mars",
            "grenade for you bruno mars",
            // --- Rihanna ---
            "umbrella ella ella rihanna",
            "work work work work rihanna",
            "shine bright like a diamond rihanna",
            "we found love rihanna",
            "don't stop the music rihanna",
            // --- Lady Gaga ---
            "born this way lady gaga",
            "poker face lady gaga",
            "bad romance lady gaga",
            "just dance lady gaga",
            // --- Usher ---
            "yeah three times usher",
            "confessions on the floor usher",
            "let it burn usher",
            // --- Chris Brown (in 'own' family above) ---
            // --- Alicia Keys ---
            "this girl is on fire alicia keys",
            "no one can get in the way alicia keys",
            "fallin' head over heels alicia keys",
            // --- John Legend ---
            "all of me loves all of you john legend",
            "ordinary people john legend",
            "glory hallelujah john legend",
        ],
    },

    // ========================================================================
    // MORE RAPPERS — scattered
    // ========================================================================
    'rapper_misc': {
        all: [
            // --- Nas ---
            "illmatic street poetry nas",
            "the world is yours nas",
            "one mic one dream nas",
            "if i ruled the world nas",
            "it was written by nas",
            "hip hop is dead long live nas",
            // --- Ludacris ---
            "move get out the way ludacris",
            "southern hospitality ludacris",
            "stand up for the real ludacris",
            "number one spot it's ludacris",
            "rollout with the bliss ludacris",
            // --- Busta Rhymes ---
            "break ya neck busta rhymes",
            "woo hah got you all in check busta rhymes",
            "dangerous busta rhymes",
            "pass the courvoisier busta rhymes",
            "flipmode squad busta rhymes",
            // --- Method Man ---
            "wu-tang is for the children method man",
            "tical on the mic method man",
            "bring the pain method man",
            "judgement day method man",
            // --- Rakim ---
            "paid in full like rakim",
            "microphone fiend rakim",
            "follow the leader rakim",
            "i ain't no joke rakim",
            // --- Slick Rick ---
            "children's story slick rick",
            "the ruler of the mic slick rick",
            "la di da di slick rick",
            // --- Lupe Fiasco ---
            "kick push and coast lupe fiasco",
            "superstar shining lupe fiasco",
            "the show goes on lupe fiasco",
            // --- Common ---
            "the light shines bright common",
            "i used to love h.e.r. common",
            "be introduction common",
            // --- Mos Def ---
            "mathematics on the mic mos def",
            "black on both sides mos def",
            "ms. fat booty mos def",
            // --- MF DOOM ---
            "all caps when you spell the man's name doom",
            "metal face villain mf doom",
            "mm food on the plate mf doom",
            "operation doomsday mf doom",
            // --- Nipsey Hussle ---
            "marathon continues nipsey hussle",
            "victory lap nipsey hussle",
            "the grind never stops nipsey hussle",
            "hussle and motivate nipsey hussle",
            // --- Pop Smoke ---
            "welcome to the party pop smoke",
            "woo walk in the building pop smoke",
            "dior on my body pop smoke",
            // --- Travis Scott ---
            "it's lit like travis scott",
            "sicko mode travis scott",
            "highest in the room travis scott",
            "goosebumps on the spot travis scott",
            "antidote for the lot travis scott",
            // --- Nicki Minaj ---
            "super bass nicki minaj",
            "barbie dreams nicki minaj",
            "starships flying nicki minaj",
            "monster verse nicki minaj",
            "queen crowned nicki minaj",
            // --- Megan Thee Stallion ---
            "hot girl summer megan thee stallion",
            "savage and she bodied it stallion",
            "real hot girl in the building stallion",
            // --- Doja Cat ---
            "say so and they say it doja cat",
            "kiss me more doja cat",
            "woman independent doja cat",
            // --- Future ---
            "mask off face the music future",
            "turn on the jets like future",
            "march madness like future",
            // --- 21 Savage ---
            "a lot on my mind 21 savage",
            "bank account stacked 21 savage",
            // --- Lil Baby ---
            "my turn and i'm up lil baby",
            "drip too hard lil baby",
            "emotionally scarred lil baby",
            // --- DJ Khaled ---
            "another one dj khaled",
            "we the best music dj khaled",
            "all i do is win dj khaled",
            "major key alert dj khaled",
            // --- 2 Chainz ---
            "birthday song 2 chainz",
            "i'm different 2 chainz",
            "big amount 2 chainz",
            // --- T.I. ---
            "whatever you like t.i.",
            "rubber band man t.i.",
            "king of the south t.i.",
            "bring em out t.i.",
            // --- Wiz Khalifa ---
            "see you again wiz khalifa",
            "black and yellow wiz khalifa",
            "roll up and blow smoke wiz khalifa",
            // --- Logic ---
            "one eight hundred logic",
            "everybody can make it logic",
            "under pressure but the magic logic",
        ],
    },

    // ========================================================================
    // HISTORICAL / CULTURAL ICON PUNCHLINES
    // ========================================================================
    'historical_misc': {
        all: [
            // --- Napoleon ---
            "conquered the world like napoleon",
            "short king energy napoleon",
            "waterloo couldn't stop me napoleon",
            // --- Julius Caesar ---
            "et tu brute like julius caesar",
            "veni vidi vici julius caesar",
            "crossed the rubicon like caesar",
            // --- Cleopatra ---
            "queen of the nile cleopatra",
            "beauty and power cleopatra",
            "ruled the empire cleopatra",
            // --- Sun Tzu ---
            "art of war like sun tzu",
            "every battle won sun tzu",
            "know your enemy sun tzu",
            // --- Einstein ---
            "genius level like einstein",
            "e equals mc einstein",
            "relatively speaking einstein",
            "theory of everything einstein",
            // --- Shakespeare ---
            "to be or not to be shakespeare",
            "romeo and juliet shakespeare",
            "all the world's a stage shakespeare",
            // --- Leonardo da Vinci ---
            "mona lisa smile da vinci",
            "renaissance man da vinci",
            "masterpiece like da vinci",
            // --- Picasso ---
            "abstract genius like picasso",
            "painted the world like picasso",
            "cubism of the flow picasso",
            // --- Steve Jobs ---
            "think different like steve jobs",
            "one more thing like steve jobs",
            "changed the world steve jobs",
            "innovation like steve jobs",
            // --- Elon Musk ---
            "to the moon like elon musk",
            "spacex to the dusk elon musk",
            "tesla driving elon musk",
            // --- Walt Disney ---
            "built the kingdom walt disney",
            "happiest place on earth disney",
            "when you wish upon a star disney",
            // --- Houdini ---
            "escape artist like houdini",
            "now you see me houdini",
            "disappeared like houdini",
            "straight jacket freedom houdini",
            // --- Malcolm X ---
            "by any means necessary malcolm x",
            "ballot or the bullet malcolm x",
            "speak the truth malcolm x",
            // --- Harriet Tubman ---
            "underground railroad harriet tubman",
            "freedom fighter harriet tubman",
            "never lost a passenger tubman",
            // --- Abraham Lincoln ---
            "emancipator abraham lincoln",
            "honest abe in the lincoln",
            "four score and seven lincoln",
            // --- JFK ---
            "ask not what your country jfk",
            "new frontier like jfk",
            "camelot vision jfk",
            // --- Barack Obama ---
            "yes we can like obama",
            "change you can believe in obama",
            "hope and change obama",
            // --- Nelson Mandela ---
            "twenty-seven years strong mandela",
            "long walk to freedom mandela",
            "rainbow nation mandela",
            // --- Gandhi ---
            "be the change like gandhi",
            "peaceful revolution gandhi",
            "salt march to the sea gandhi",
        ],
    },

    // ========================================================================
    // MOVIE PUNCHLINES — additional references
    // ========================================================================
    'movie_misc': {
        all: [
            // --- The Godfather ---
            "made an offer you can't refuse godfather",
            "leave the gun take the cannoli godfather",
            "it's not personal it's strictly business godfather",
            "don corleone at the throne godfather",
            // --- Goodfellas ---
            "funny how funny like a clown goodfellas",
            "as far back as i can remember goodfellas",
            // --- Training Day ---
            "king kong got nothing on me training day",
            "this is a business of wolves training day",
            // --- Fight Club ---
            "first rule of fight club",
            "i am jack's complete lack of surprise fight club",
            // --- The Shawshank Redemption ---
            "get busy living shawshank",
            "hope is a good thing shawshank",
            "crawled through it all shawshank",
            // --- Forrest Gump ---
            "life is like a box of chocolates gump",
            "run forrest run gump",
            "stupid is as stupid does gump",
            // --- Star Wars ---
            "may the force be with you star wars",
            "i am your father star wars",
            "do or do not there is no try star wars",
            "the dark side is strong star wars",
            "these aren't the droids star wars",
            // --- The Matrix ---
            "free your mind the matrix",
            "there is no spoon the matrix",
            "welcome to the real world matrix",
            "follow the white rabbit matrix",
            // --- Gladiator ---
            "are you not entertained gladiator",
            "at my signal unleash hell gladiator",
            "strength and honor gladiator",
            // --- 300 ---
            "this is sparta 300",
            "tonight we dine in hell 300",
            // --- Rocky ---
            "gonna fly now rocky",
            "it ain't about how hard you hit rocky",
            "adrian i did it rocky",
            "going the distance rocky",
            // --- 8 Mile ---
            "lose yourself in the moment 8 mile",
            "one shot one opportunity 8 mile",
            "trailer park to the spotlight 8 mile",
            // --- Django Unchained ---
            "the d is silent django",
            "unchained and unafraid django",
            // --- Black Panther ---
            "wakanda forever black panther",
            "vibranium strong black panther",
            // --- The Dark Knight ---
            "why so serious the dark knight",
            "you either die a hero dark knight",
            "some men just want to watch the world burn dark knight",
            // --- Joker ---
            "put on a happy face joker",
            "all it takes is one bad day joker",
            // --- John Wick ---
            "i'm thinking i'm back john wick",
            "pencil kills john wick",
            "continental rules john wick",
            // --- Breaking Bad ---
            "i am the one who knocks breaking bad",
            "say my name breaking bad",
            "the one who knocks breaking bad",
            // --- Game of Thrones ---
            "winter is coming game of thrones",
            "a lannister always pays game of thrones",
            "valar morghulis game of thrones",
            "bend the knee game of thrones",
            // --- The Wire ---
            "the game is the game the wire",
            "all in the game the wire",
            "come at the king you best not miss the wire",
            // --- Sopranos ---
            "woke up this morning sopranos",
            "waste management sopranos",
            // --- Power ---
            "ghost protocol like power",
            "big rich town power",
        ],
    },

    // ========================================================================
    // 'ation' family — MASSIVE — dedication, imagination, etc.
    // ========================================================================
    'ation': {
        all: [
            // --- Celebrity punchlines ---
            "stevie wonder imagination inspiration",
            "aretha franklin natural woman revelation",
            "frank sinatra my way the destination",
            "whitney houston greatest love manifestation",
            "prince purple rain the sensation",
            "jimi hendrix purple haze hallucination",
            "elvis presley the king of the nation",
            "beyonce formation the foundation",
            "jay-z roc nation the corporation",
            "kendrick lamar dna the revelation",
            "kanye west graduation the celebration",
            "drake started from the bottom motivation",
            "eminem lose yourself determination",
            "travis scott astroworld the sensation",
            "nipsey hussle marathon the motivation",
            "doja cat woman liberation",
            "megan thee stallion hot girl calculation",
            "denzel washington training day domination",
            "keanu reeves matrix simulation",
            "morgan freeman narration of the nation",
            "arnold schwarzenegger termination",
            "vin diesel fast and furious acceleration",
            "steph curry three-point assassination",
            "kobe mamba mentality dedication",
            "lebron james the chosen coronation",
            "floyd mayweather undefeated domination",
            "usain bolt world record acceleration",
            "serena williams grand slam domination",
            "conor mcgregor notorious confrontation",
            "michael jordan air transportation",
            "tom brady seven-ring coronation",
            // --- Game show punchlines ---
            "jeopardy answer the interrogation",
            "family feud top of the population",
            "wheel of fortune spinning the fascination",
            "price is right the valuation",
            // --- Movie/TV punchlines ---
            "godfather made an obligation",
            "scarface money power elevation",
            "fight club first rule the limitation",
            "inception deeper in the imagination",
            "avengers assembled the operation",
            "breaking bad the transformation",
            "game of thrones the domination",
            // --- Setup lines ---
            "dedication to the occupation",
            "imagination beyond the limitation",
            "motivation for the generation",
            "inspiration from the situation",
            "elevation past every station",
            "celebration of the revelation",
            "foundation of the reputation",
            "education of the population",
            "liberation from the frustration",
            "devastation turned to motivation",
            "congregation of the innovation",
            "manifestation of the transformation",
            "constellation of the correlation",
            "fascination with the destination",
            "proclamation of the restoration",
            "confrontation at the graduation",
            "compensation for the desperation",
            "accumulation of the information",
            "retaliation from the provocation",
            "hallucination or the revelation",
            "assassination of the reputation",
            "globalization of the sensation",
            "improvisation at the celebration",
            "initialization of the operation",
            "polarization of the nation",
            "visualization of the destination",
            "authorization for the collaboration",
            "improvisation meets the fascination",
            "capitalization on the automation",
        ],
        dark: [
            "condemnation of the damnation",
            "annihilation of the population",
            "starvation in the isolation",
            "damnation of the situation",
            "suffocation of the limitation",
            "desolation of the civilization",
        ],
        aggressive: [
            "domination through elimination",
            "retaliation with no hesitation",
            "obliteration of the opposition",
            "annihilation with determination",
            "assassination with no deviation",
            "intimidation is my reputation",
        ],
    },

    // ========================================================================
    // 'otion' family — motion, devotion, ocean
    // ========================================================================
    'otion': {
        all: [
            // --- Celebrity punchlines ---
            "frank sinatra fly me to the ocean of emotion",
            "whitney houston saving all my love devotion",
            "prince purple rain in slow motion",
            "beyonce crazy in love the potion",
            "adele rolling in the deep emotion",
            "drake in my feelings the commotion",
            "juice wrld lucid dreams the emotion",
            "stevie wonder overjoyed the notion",
            "marvin gaye what's going on the emotion",
            "bob marley one love the devotion",
            // --- Movie references ---
            "titanic sinking in the ocean of emotion",
            "inception dreams in slow motion",
            "matrix bullet time slow motion",
            // --- Setup lines ---
            "set the wheels in motion",
            "deeper than the ocean",
            "blind devotion to the notion",
            "magic potion for the commotion",
            "locomotion of the promotion",
            "demotion to the slow motion",
            "raw emotion like a love potion",
            "explosion of the promotion",
            "erosion of the devotion",
            "corrosion from the emotion",
            "superstition or the premonition notion",
            "self-promotion with the devotion",
            "perpetual motion in the ocean",
        ],
        dark: [
            "poison potion in the dark devotion",
            "cold emotion frozen like the ocean",
            "drowning in the ocean of emotion",
        ],
        aggressive: [
            "explosive motion causing commotion",
            "hostile demotion of the devotion",
        ],
    },

    // ========================================================================
    // 'ision' family — vision, decision, precision
    // ========================================================================
    'ision': {
        all: [
            // --- Celebrity punchlines ---
            "kendrick lamar dna precision",
            "jay-z business decision",
            "eminem rap god with precision",
            "steve jobs think different the vision",
            "einstein theory with precision",
            "kanye west creative vision",
            "denzel washington training day decision",
            "kobe mamba precision",
            "steph curry three-point precision",
            "floyd mayweather defensive precision",
            "dr. dre beats with precision",
            "nipsey hussle marathon vision",
            // --- Movie references ---
            "matrix bullet dodge precision",
            "inception level of the vision",
            "avengers endgame the decision",
            // --- Setup lines ---
            "twenty-twenty vision",
            "surgical precision in the incision",
            "tunnel vision with the provision",
            "collision of the division",
            "television of the revision",
            "supervision of the provision",
            "derision of the indecision",
            "circumcision of the decision",
            "intermission of the revision",
            "ammunition for the precision",
            "x-ray vision with precision",
            "night vision on the collision",
            "peripheral vision with provision",
            "double vision in the television",
            "premonition turned to the precision",
        ],
        dark: [
            "blurred vision in the division",
            "cold incision with precision",
            "dark revision of the collision",
        ],
        aggressive: [
            "head-on collision no revision",
            "surgical precision in the incision",
            "nuclear fission with precision",
        ],
    },

    // ========================================================================
    // 'ession' family — session, confession, obsession
    // ========================================================================
    'ession': {
        all: [
            // --- Celebrity punchlines ---
            "usher confessions in the session",
            "eminem cleaning out the confession",
            "kanye west beautiful dark obsession",
            "drake take care of the confession",
            "adele hello from the other session",
            "j. cole born sinner the confession",
            "kendrick lamar humble the expression",
            "jay-z reasonable doubt impression",
            "logic under pressure the expression",
            "juice wrld all girls the obsession",
            // --- Movie references ---
            "fight club the first impression",
            "godfather business not aggression",
            "breaking bad the dark progression",
            // --- Setup lines ---
            "studio session with the expression",
            "confession after the obsession",
            "depression to the progression",
            "first impression of the succession",
            "regression from the aggression",
            "profession of the concession",
            "suppression of the expression",
            "possession of the obsession",
            "intercession for the confession",
            "compression of the impression",
            "accession to the succession",
            "indiscretion of the session",
            "digression from the profession",
            "microaggression in the expression",
            "recession to the progression",
        ],
        dark: [
            "dark confession in the depression",
            "suppression of the deep obsession",
            "repression of the dark expression",
        ],
        aggressive: [
            "aggression in the power session",
            "hostile possession of the confession",
            "total domination no concession",
        ],
    },

    // ========================================================================
    // 'assion' family — passion, fashion, compassion
    // ========================================================================
    'assion': {
        all: [
            // --- Celebrity punchlines ---
            "prince when doves cry the passion",
            "beyonce fierce in the fashion",
            "rihanna shine like a diamond fashion",
            "lady gaga born this way fashion",
            "kanye west yeezy brand fashion",
            "travis scott cactus jack the fashion",
            "donatella versace in the fashion",
            "cardi b drip in the fashion",
            "nicki minaj barbie fashion",
            // --- Setup lines ---
            "burning with the passion",
            "compassion is the fashion",
            "old-fashion with the new passion",
            "ration the compassion",
            "irrational passion beyond the fashion",
            "assassin with the passion and the fashion",
            "crash-landed with the passion",
            "everlasting passion in the fashion",
            "high fashion with compassion",
            "satisfaction from the passion",
            "interaction with the fashion passion",
            "moustache in the old fashion",
            "ashen-faced with the passion",
            "out of fashion but the passion ration",
        ],
        dark: [
            "dark passion and the ashen fashion",
            "crime of passion in the old fashion",
        ],
        aggressive: [
            "assassin passion no compassion",
            "smash it crash it passion",
        ],
    },

    // ========================================================================
    // 'ore' family — more, floor, score
    // ========================================================================
    'ore': {
        all: [
            // --- Celebrity punchlines ---
            "michael jordan final score and more",
            "kobe eighty-one the high score",
            "steph curry three-point the encore",
            "lebron james witness the folklore",
            "floyd mayweather settled the score",
            "serena williams aced the score",
            "denzel washington training day encore",
            "morgan freeman opens the door",
            "the rock electrifying the floor",
            "al pacino scarface and more",
            "jay-z roc nation galore",
            "dr. dre beats to the core",
            "eminem rap god to the core",
            "kendrick lamar humble the score",
            // --- Movie references ---
            "godfather offer you can't ignore",
            "rocky going the distance for more",
            "star wars force to the core",
            "john wick pencil on the floor",
            "gladiator are you not wanting more",
            // --- Game show references ---
            "jeopardy final score",
            "price is right on the floor",
            "wheel of fortune encore",
            // --- Setup lines ---
            "settle the score on the dance floor",
            "even the score and then some more",
            "open the door to the corridor",
            "hardcore to the very core",
            "folklore of the troubadour",
            "ambassador to the commodore",
            "nevermore said the nevermore",
            "furthermore and the evermore",
            "matador on the dance floor",
            "metaphor for the corridor",
            "velociraptor on the dance floor dinosaur",
            "seashore to the ocean floor",
            "sophomore on the dance floor",
            "reservoir to the encore more",
            "baltimore to singapore",
            "carnivore herbivore omnivore",
            "evermore furthermore forevermore",
            "underscore of the troubadour",
        ],
        dark: [
            "blood on the dance floor",
            "nevermore on the ocean floor",
            "cold war behind the iron door",
        ],
        aggressive: [
            "settle the score and even more",
            "carnivore at the iron door",
            "uproar from the warzone floor",
        ],
    },

    // ========================================================================
    // 'ine' family — line, mine, fine, wine, shine, divine
    // ========================================================================
    'ine': {
        all: [
            // --- Celebrity punchlines ---
            "einstein genius that's divine",
            "eminem bars on every line",
            "kendrick lamar the punchline",
            "jay-z blueprint by design",
            "kanye west power is mine",
            "drake god's plan the outline",
            "prince party like it's ninety-nine",
            "frank sinatra new york skyline",
            "bob marley everything gonna be fine",
            "stevie wonder you are the sunshine",
            "beyonce drunk in love like wine",
            "adele someone like you valentine",
            "freddie mercury bohemian rhapsody the goldmine",
            "david bowie starman on the line",
            // --- Movie references ---
            "godfather i'll make him decline",
            "scarface the world is mine",
            "fight club thin red line",
            // --- Setup lines ---
            "crossing every finish line",
            "diamond in the coalmine",
            "sunshine after the decline",
            "bottom line on the front line",
            "headline on the dateline",
            "sideline to the frontline",
            "borderline on the timeline",
            "concubine to the valentine",
            "porcupine on the serpentine",
            "columbine to the turpentine vine",
            "discipline on the trampoline line",
            "crystalline moonshine divine",
            "alkaline and the landmine fine",
            "aquamarine and the tangerine line",
            "intertwine the grapevine wine",
            "feline on the medicine line",
            "masculine and the feminine divine",
            "quarantine to the magazine line",
            "gasoline on the clothesline vine",
            "figurine on the tambourine line",
        ],
        dark: [
            "landmine on the thin line",
            "flatline on the decline",
            "nighttime on the breadline",
        ],
        aggressive: [
            "frontline with the landmine",
            "firing line on the deadline",
            "wartime on the bottom line",
        ],
    },

    // ========================================================================
    // 'ide' family — ride, side, pride, guide, wide
    // ========================================================================
    'ide': {
        all: [
            // --- Celebrity punchlines ---
            "tupac california love ride the westside",
            "biggie notorious with the pride",
            "nipsey hussle victory lap the pride ride",
            "kendrick lamar swimming pools to the other side",
            "jay-z brooklyn finest on the ride",
            "drake started from the bottom with pride",
            "post malone rockstar on the ride",
            "travis scott highest in the room my guide",
            "kobe mamba mentality the pride inside",
            "lebron james the king worldwide",
            "michael jordan six rings and the pride",
            "serena williams grand slam the pride ride",
            "denzel washington man on fire worldwide",
            "keanu reeves john wick on the ride",
            // --- Movie references ---
            "fast and furious ride or die pride",
            "dark knight hero on the other side",
            "star wars join the dark side",
            // --- Setup lines ---
            "nationwide on the countryside ride",
            "homicide on the riverside",
            "oceanside to the mountainside",
            "fireside on the poolside guide",
            "genocide of the pesticide",
            "landslide on the waterside",
            "bedside to the blindside ride",
            "outside looking from the inside",
            "suicide to the curbside pride",
            "coincide with the eventide",
            "bona fide and the bonafide ride",
            "alongside on the broadside guide",
            "cyanide on the underside",
            "rawhide on the hillside stride",
            "yuletide on the riptide ride",
            "poolside to the fireside guide",
            "divide and override the ride",
            "joyride on the wild side",
        ],
        dark: [
            "dark side of the riverside",
            "cyanide on the homicide ride",
            "blindside of the genocide",
        ],
        aggressive: [
            "broadside on the wartime ride",
            "override and the landslide",
            "collide with the riptide pride",
        ],
    },

    // ========================================================================
    // 'ove' family — love, above, shove, dove, glove
    // ========================================================================
    'ove': {
        all: [
            // --- Celebrity punchlines ---
            "beyonce crazy in love above",
            "whitney houston greatest love of love",
            "stevie wonder i just called love",
            "marvin gaye let's get it on love",
            "bob marley one love is enough love",
            "john legend all of me all love",
            "adele someone like you love",
            "prince when doves cry above",
            "rihanna we found love above",
            "alicia keys this girl is on fire love",
            "frank sinatra fly me to the moon above",
            "aretha franklin natural woman love",
            "drake in my feelings love",
            "the weeknd blinding lights above",
            "bruno mars just the way you are love",
            // --- Movie references ---
            "titanic i'm king of the world above",
            "notebook it wasn't over love",
            // --- Setup lines ---
            "rising far above",
            "turtle dove from above",
            "hand in glove from above",
            "push comes to shove",
            "dreaming of the stars above",
            "kingdom come from above",
            "foxglove in the treasure trove",
            "ladylove from the stars above",
            "thereof and the above of love",
            "thereof or thereof above",
            "turtledove from the treasure trove",
            "boxing glove from the lord above",
            "hereof thereof the love thereof",
            "velvet glove from up above",
        ],
        dark: [
            "dark love from the depths above",
            "cold shove of the tainted love",
            "mourning dove from the grave above",
        ],
        aggressive: [
            "iron fist in a velvet glove",
            "push and shove from the stars above",
        ],
    },

    // ========================================================================
    // 'eed' family — speed, need, lead, breed, feed
    // ========================================================================
    'eed': {
        all: [
            // --- Celebrity punchlines ---
            "usain bolt lightning speed",
            "eminem rap god guaranteed",
            "kendrick lamar dna the seed",
            "jay-z blueprint take the lead",
            "nipsey hussle marathon proceed",
            "travis scott sicko mode stampede",
            "dr. dre chronic indeed",
            "kanye west power take the lead",
            "steph curry shooting at full speed",
            "the weeknd blinding lights proceed",
            // --- Setup lines ---
            "planted the seed and let it feed",
            "full speed ahead and guaranteed",
            "take the lead and never concede",
            "stampede of the centipede",
            "misdeed on the creed of greed",
            "indeed the only breed that i need",
            "proceed with the intercede",
            "pedigree of the stampede breed",
            "seaweed on the tumbleweed",
            "nosebleed on the guaranteed",
            "exceed the speed i need to lead",
            "decreed the creed of the reed",
            "chickweed to the milkweed feed",
            "succeed and proceed indeed",
        ],
        dark: [
            "bloodfeed on the bitter seed",
            "nosebleed from the dirty deed",
        ],
        aggressive: [
            "stampede and exceed the speed",
            "warbreed on the centipede",
        ],
    },

    // ========================================================================
    // 'eat' family — heat, beat, street, feat, defeat
    // ========================================================================
    'eat': {
        all: [
            // --- Celebrity punchlines ---
            "dr. dre the chronic on the beat",
            "eminem lose yourself in the heat",
            "tupac dear mama on the street",
            "biggie juicy on the beat",
            "nas illmatic of the street",
            "jay-z run this town on the concrete",
            "kendrick lamar humble take the seat",
            "kanye west stronger on the beat",
            "travis scott it's lit bring the heat",
            "beyonce formation on the beat",
            "drake hotline bling repeat",
            "lil wayne a milli on the beat",
            // --- Movie references ---
            "rocky training on the street",
            "8 mile rap battle on the concrete",
            // --- Setup lines ---
            "bring the heat and take the seat",
            "dead on my feet but i compete",
            "concrete jungle of the street",
            "heartbeat of the drumbeat sweet",
            "elite compete on the obsolete",
            "bittersweet on the back street",
            "parakeet on the window seat",
            "incomplete but i can't be beat",
            "worksheet on the spreadsheet neat",
            "buckwheat on the back seat street",
            "mincemeat on the receipt sheet",
            "deadbeat on the drum beat heat",
            "athlete on the balance sheet",
            "upbeat downbeat offbeat street",
        ],
        dark: [
            "cold street where the lost souls meet",
            "dead heat in the midnight street",
        ],
        aggressive: [
            "defeat the elite in the heat",
            "dead meat on the backstreet beat",
        ],
    },

    // ========================================================================
    // 'ack' family — back, attack, track, black, stack
    // ========================================================================
    'ack': {
        all: [
            // --- Celebrity punchlines ---
            "jay-z blueprint is the throwback",
            "eminem slim shady the comeback",
            "tupac hit em up on the attack",
            "biggie notorious with the stack",
            "arnold schwarzenegger i'll be back",
            "kanye west black skinhead the setback",
            "kendrick lamar humble the payback",
            "drake god's plan and the comeback",
            "lil wayne no ceilings on the track",
            "50 cent get rich the flashback",
            "travis scott cactus jack attack",
            // --- Movie references ---
            "terminator i'll be back",
            "rocky gets knocked down comes back",
            "john wick pencil attack",
            // --- Setup lines ---
            "counterattack on the railroad track",
            "setback to the feedback stack",
            "throwback on the quarterback sack",
            "rucksack on the outback track",
            "flapjack on the crackerjack",
            "backtrack on the paperback",
            "racetrack to the smokestack",
            "drawback of the kickback rack",
            "knickknack in the paddy-whack",
            "almanac on the zodiac",
            "cul-de-sac on the cadillac track",
            "haversack on the almanac track",
            "lumberjack on the maniac attack",
            "amnesiac on the insomniac track",
        ],
        dark: [
            "heart attack in the pitch black",
            "cold feedback from the setback",
        ],
        aggressive: [
            "all-out attack never hold back",
            "counterattack on the smokestack",
        ],
    },

    // ========================================================================
    // 'ess' family — success, bless, express, impress
    // ========================================================================
    'ess': {
        all: [
            // --- Celebrity punchlines ---
            "jay-z roc nation success",
            "kanye west runaway the excess",
            "drake god's plan express",
            "beyonce flawless nothing less",
            "oprah living her best success",
            "steve jobs one more thing finesse",
            "nipsey hussle marathon the process",
            "dj khaled another one success",
            "j. cole no features no stress",
            // --- Setup lines ---
            "nothing less than success",
            "finesse in the business address",
            "bless the progress no distress",
            "impress with the access process",
            "transgress to the egress express",
            "largesse of the success recess",
            "regress to the progress profess",
            "governess of the express finesse",
            "more or less i confess the success",
            "excess on the progress compress",
            "reckless with finesse nonetheless",
            "limitless success i profess",
            "buttress of the fortress express",
            "headdress on the letterpress",
            "watercress on the recess express",
        ],
        dark: [
            "duress in the darkness distress",
            "suppress the stress nonetheless",
        ],
        aggressive: [
            "aggress and oppress with success",
            "merciless address to impress",
        ],
    },

    // ========================================================================
    // 'ub2' family — club, hub, scrub, dub
    // ========================================================================
    'ub2': {
        all: [
            // --- 50 Cent punchlines ---
            "in da club like 50 in the hub",
            "bottle service at the club fifty dub",
            // --- DJ Khaled punchlines ---
            "another one in the club dj khaled dub",
            "we the best music at the club dj khaled hub",
            // --- Setup lines ---
            "nightclub in the bathtub scrub",
            "dubstep in the hub grub",
            "pub crawl at the shrub",
            "hubbub in the cub club",
        ],
    },

    // ========================================================================
    // 'ow' family — flow, show, go, know, grow
    // ========================================================================
    'ow': {
        all: [
            // --- Celebrity punchlines ---
            "eminem rap god let the flow go",
            "nas illmatic with the flow",
            "biggie hypnotize the show",
            "jay-z run this town the flow",
            "kanye west stronger let it grow",
            "drake started from below",
            "kendrick lamar humble the flow",
            "lil wayne best alive the flow",
            "snoop dogg gin and juice let it flow",
            "j. cole no features but the flow",
            "nicki minaj monster with the flow",
            "logic everybody let it go",
            "dr. dre aftermath let it flow",
            // --- Setup lines ---
            "let it flow let it grow let it show",
            "head to toe watch the money overflow",
            "status quo but i'm stealing the show",
            "undertow of the vertigo",
            "afterglow of the outflow",
            "mistletoe in the bungalow",
            "buffalo in the undertow",
            "portfolio of the domino",
            "calico on the radio show",
            "embryo to the dynamo flow",
            "archipelago down below",
            "torpedo on the undergo",
            "espresso at the rodeo show",
            "manifesto of the crescendo flow",
        ],
        dark: [
            "deathblow in the undertow",
            "shadow of the down below",
        ],
        aggressive: [
            "deathblow to the status quo",
            "torpedo and the overflow",
        ],
    },

    // ========================================================================
    // 'ame2' family expansion — flame, game, fame, name, shame
    // ========================================================================
    'ame2': {
        all: [
            // --- More celebrity punchlines for -ame ---
            "michael jordan changed the game forever flame",
            "kobe bryant mamba mentality no shame",
            "steph curry three-point changed the game",
            "kevin durant the slim reaper claims the fame",
            "tom brady seven rings hall of fame",
            "serena williams grand slam the fame",
            "tiger woods sunday red in the frame of fame",
            // --- Setup lines ---
            "video game to the hall of fame",
            "end game on the picture frame",
            "ballgame changed the name and the flame",
            "zero-sum game with no one to blame",
        ],
    },

    // ========================================================================
    // 'ong' family — strong, song, wrong, long, belong
    // ========================================================================
    'ong': {
        all: [
            // --- Celebrity punchlines ---
            "bob marley redemption song",
            "stevie wonder signed and sealed along",
            "whitney houston i will always be strong",
            "aretha franklin respect the song",
            "freddie mercury we are the champions strong",
            "tupac keep ya head up stay strong",
            "biggie notorious all day long",
            "jay-z empire state sing along",
            "beyonce formation standing strong",
            "adele rolling in the deep so long",
            // --- Setup lines ---
            "king kong standing strong all day long",
            "sing-along to the lifelong song",
            "ding dong the sing-song gong",
            "pingpong on the prolong strong",
            "headstrong on the furlong throng",
            "oblong on the singalong strong",
            "sarong on the hong kong gong",
            "mahjong at the singalong strong",
            "dugong on the billabong long",
            "evensong on the headstrong gong",
        ],
        dark: [
            "what went wrong all along",
            "swan song in the ding dong gone",
        ],
        aggressive: [
            "headstrong smashing the gong",
            "king kong coming on strong",
        ],
    },

    // ========================================================================
    // 'ank' family — bank, tank, rank, blank, thank
    // ========================================================================
    'ank': {
        all: [
            // --- Celebrity punchlines ---
            "floyd mayweather money in the bank",
            "50 cent get rich hit the bank",
            "rick ross stacking paper at the bank",
            "jay-z roc nation filling up the bank",
            "dj khaled another one in the bank",
            "2 chainz birthday in the bank",
            "21 savage bank account no blank",
            // --- Setup lines ---
            "break the bank with a thank you frank",
            "military rank at the think tank",
            "fish tank to the outflank",
            "point-blank on the riverbank",
            "gangplank to the rank and the dank",
            "snowbank on the outrank plank",
            "crank the tank and the embank",
            "prankster on the plank blank",
        ],
        dark: [
            "sank in the rank of the blank",
            "dank and dark on the riverbank",
        ],
        aggressive: [
            "point-blank from the battle tank",
            "outrank and outflank the rank",
        ],
    },

    // ========================================================================
    // 'eal2' family expansion — feel, real, deal, steal, heal
    // ========================================================================
    'eal2': {
        all: [
            // --- More celebrity punchlines ---
            "alicia keys this girl is on fire the ordeal",
            "john legend all of me is how i feel",
            "usher confessions for the real deal",
            "bruno mars 24k how it feel",
            // --- Setup lines ---
            "sex appeal on the big deal",
            "commonweal on the ideal reel",
            "oatmeal on the windshield feel",
            "newsreel on the genteel appeal",
        ],
    },

    // ========================================================================
    // 'ife' family — life, knife, strife, wife
    // ========================================================================
    'ife': {
        all: [
            // --- Celebrity punchlines ---
            "tupac me against the world that's life",
            "biggie life after death in the strife",
            "j. cole born sinner is the life",
            "nipsey hussle marathon is life",
            "nas illmatic street life",
            "eminem lose yourself in this life",
            "drake take care of this life",
            "kendrick lamar good kid mad city life",
            "oprah living your best life",
            // --- Movie references ---
            "forrest gump life is like a box of life",
            "shawshank get busy living life",
            "fight club this is your life",
            // --- Setup lines ---
            "cutting like a knife through life",
            "husband and the wife in this life",
            "afterlife of the pocket knife",
            "jackknife through the strife of life",
            "midlife and the afterlife",
            "wildlife in the nightlife strife",
            "shelf life of the midlife knife",
            "lowlife to the high life",
            "still life of the midlife",
        ],
        dark: [
            "knife's edge of the afterlife",
            "strife in the dark of this life",
        ],
        aggressive: [
            "jackknife through the strife of life",
            "switchblade and the afterlife",
        ],
    },

    // ========================================================================
    // 'ose2' family — close, most, ghost, coast, post, toast
    // ========================================================================
    'oast': {
        all: [
            // --- Celebrity punchlines ---
            "dr. dre west coast the most",
            "snoop dogg west coast toast",
            "tupac california love the coast",
            "post malone rockstar coast to coast",
            "biggie east coast the utmost",
            "nas east coast the foremost",
            // --- Setup lines ---
            "coast to coast from post to post",
            "the one who matters most",
            "french toast on the west coast",
            "holy ghost on the east coast post",
            "signpost on the goalpost toast",
            "lamppost on the outpost coast",
            "compost on the bedpost toast",
            "doorpost to the goalpost most",
            "innermost to the uttermost post",
            "diagnose the engrossed coast",
        ],
        dark: [
            "ghost on the desolate coast",
            "almost lost on the dark coast",
        ],
    },

    // ========================================================================
    // 'ope' family — hope, scope, rope, dope
    // ========================================================================
    'ope': {
        all: [
            // --- Celebrity punchlines ---
            "obama yes we can the hope",
            "tupac keep ya head up scope and hope",
            "kendrick lamar alright the hope",
            "nipsey hussle marathon the scope of hope",
            "j. cole dreamville is the scope",
            "bob marley one love hope and cope",
            "mandela long walk to the hope",
            // --- Setup lines ---
            "dope flow with a telescope scope",
            "tightrope on the horoscope",
            "antelope on the stethoscope",
            "kaleidoscope and the periscope",
            "misanthrope on the gyroscope",
            "envelope of the isotope",
            "cantaloupe on the downslope rope",
            "microscope on the tightrope",
        ],
        dark: [
            "no hope on the tightrope",
            "grope in the dark with no scope",
        ],
    },

    // ========================================================================
    // 'ust' family — trust, bust, must, just, dust
    // ========================================================================
    'ust': {
        all: [
            // --- Celebrity punchlines ---
            "jay-z reasonable doubt the trust",
            "eminem not afraid and i must",
            "tupac only god can judge the trust",
            "biggie ten crack commandments adjust",
            "kanye west through the wire robust",
            "kendrick lamar loyalty the trust",
            "nipsey hussle grind is a must",
            "50 cent many men distrust",
            "dmx where the hood at just",
            "freddie mercury another one bites the dust",
            // --- Setup lines ---
            "in god we trust and it's a must",
            "wanderlust and the stardust",
            "readjust from the sawdust",
            "combust in the disgust",
            "robust and the bloodlust",
            "unjust but i adjust the thrust",
            "antitrust on the pixie dust",
            "sawdust to the stardust trust",
            "crust of the wanderlust bust",
            "robust against the gust of dust",
        ],
        dark: [
            "distrust in the sawdust dust",
            "bloodlust and the dark disgust",
        ],
        aggressive: [
            "combust and readjust the thrust",
            "robust bust through the unjust",
        ],
    },

    // ========================================================================
    // 'aw' family — raw, law, jaw, saw, draw
    // ========================================================================
    'aw': {
        all: [
            // --- Celebrity punchlines ---
            "eddie murphy raw and the law",
            "mike tyson broke the jaw",
            "tupac outlaw spitting raw",
            "biggie notorious raw",
            "jay-z blueprint draw the law",
            "conor mcgregor left hand to the jaw",
            "floyd mayweather undefeated the last straw",
            // --- Setup lines ---
            "above the law and the outlaw raw",
            "jigsaw of the see-saw draw",
            "last straw on the outlaw raw",
            "chainsaw on the southpaw jaw",
            "coleslaw at the mackinaw draw",
            "in-law on the overhaul braw",
            "withdrawal from the freefall law",
            "outlaw on the jackdaw raw",
            "tomahawk from the southpaw",
            "seesaw on the chainsaw draw",
        ],
        dark: [
            "cold raw on the outlaw draw",
            "iron jaw in the dark maw",
        ],
    },

    // ========================================================================
    // 'ick' family — quick, sick, trick, slick, kick
    // ========================================================================
    'ick': {
        all: [
            // --- Celebrity punchlines ---
            "slick rick the ruler with the trick",
            "nicki minaj super bass hit quick",
            "john wick pencil trick flick",
            "bruce lee one-inch kick",
            "jackie chan flying sidekick",
            "chuck norris roundhouse kick",
            "allen iverson crossover quick",
            // --- Setup lines ---
            "hat trick with the rhetoric",
            "lipstick on the drumstick thick",
            "maverick of the sidekick",
            "lunatic with the arithmetic",
            "candlestick in the broomstick trick",
            "toothpick and the chopstick flick",
            "joystick on the slapstick",
            "peacenik with the beatnik trick",
            "homesick on the seasick brick",
            "lovesick with the hat trick",
        ],
        dark: [
            "cold sick in the thick of it quick",
            "arsenic in the rhetoric thick",
        ],
        aggressive: [
            "dropkick and the sidekick",
            "hat trick with no rhetoric",
        ],
    },

    // ========================================================================
    // 'ess2' family — less, bless, mess, press, address
    // ========================================================================
    'ess2': {
        all: [
            // --- Celebrity punchlines ---
            "dj khaled blessed and nothing less",
            "j. cole born sinner confess and bless",
            "kanye west ultralight bless",
            "nipsey hussle marathon express no less",
            // --- Setup lines ---
            "nevertheless and the nothingness",
            "more or less in the wilderness",
            "effortless on the limitless",
            "powerless in the thoughtfulness",
            "recklessness of the carelessness",
            "breathless in the restlessness",
            "pricelessness of the timelessness",
            "formlessness in the weightlessness",
        ],
    },

    // ========================================================================
    // 'ope2' family — hope, nope, cope, scope, dope, rope
    // ========================================================================

    // ========================================================================
    // 'uck' family — luck, truck, stuck, duck, buck
    // ========================================================================
    'uck': {
        all: [
            // --- Celebrity punchlines ---
            "50 cent get rich no bad luck",
            "eminem not afraid never stuck",
            "kendrick lamar humble never duck",
            "jay-z big pimpin' making a buck",
            // --- Setup lines ---
            "thunderstruck with the good luck",
            "dumbstruck and the starstruck",
            "woodchuck in the dump truck",
            "potluck and the nunchuck",
            "moonstruck and the starstruck",
            "canuck on the woodchuck luck",
            "awestruck by the lightning struck",
        ],
        dark: [
            "down on my luck and stuck",
            "horror-struck in the muck",
        ],
    },

    // ========================================================================
    // 'old' family — gold, hold, bold, told, cold, sold
    // ========================================================================
    'old': {
        all: [
            // --- Celebrity punchlines ---
            "kanye west gold digger told",
            "jay-z blueprint worth its weight in gold",
            "drake hold on we're going bold",
            "michael jordan six rings of gold",
            "floyd mayweather undefeated and bold",
            "the rock people's champ bold as gold",
            "tupac only god can judge behold",
            // --- Setup lines ---
            "heart of gold and i'm breaking the mold",
            "stone cold but the legend is told",
            "stronghold of the household gold",
            "blindfold on the scaffold bold",
            "manifold on the threshold hold",
            "marigold in the stranglehold",
            "centerfold of the household",
            "foothold on the stronghold gold",
            "untold stories of the bold",
            "behold the unfold of the gold",
        ],
        dark: [
            "ice cold in the blindfold",
            "stone cold and the stories untold",
        ],
        aggressive: [
            "stranglehold on the household gold",
            "chokehold bold and the manifold",
        ],
    },

    // ========================================================================
    // 'ess3' family — stress, success, impress, express
    // ========================================================================

    // ========================================================================
    // 'ot' family — hot, shot, got, spot, lot, not
    // ========================================================================
    'ot': {
        all: [
            // --- Celebrity punchlines ---
            "travis scott it's lit that's hot",
            "50 cent many men took the shot",
            "eminem one shot one opportunity got",
            "drake hotline bling on the spot",
            "snoop dogg drop it like it's hot",
            "nelly hot in here on the dot",
            "dj khaled we the best shot",
            "pop smoke welcome to the party hot spot",
            "21 savage a lot on the dot",
            "lil baby my turn hit the jackpot",
            // --- Movie references ---
            "godfather the offer cannot be forgot",
            "scarface say hello to the gunshot",
            "matrix dodge the bullet shot",
            // --- Setup lines ---
            "give it everything you got",
            "ready or not on the dot",
            "jackpot on the parking lot",
            "buckshot on the crockpot",
            "slingshot from the mascot",
            "blind spot on the ink blot",
            "bloodshot on the long shot",
            "hotshot on the topknot slot",
            "flowerpot on the melting pot",
            "afterthought on the astronaut hot",
            "overshot on the apricot slot",
            "snapshot on the polka dot",
        ],
        dark: [
            "blood clot on the gunshot lot",
            "dark thought and the blind spot",
        ],
        aggressive: [
            "headshot on the killshot hot",
            "buckshot from the gunshot dot",
        ],
    },

    // ========================================================================
    // 'ue' family — true, through, blue, new, crew, few
    // ========================================================================
    'ue': {
        all: [
            // --- Celebrity punchlines ---
            "eazy-e straight outta compton the crew",
            "wu-tang clan nothing to play with the crew",
            "jay-z roc nation and the crew",
            "dr. dre aftermath coming through",
            "eminem d-12 the whole crew",
            "snoop dogg d-o-double-g it's true",
            "kendrick lamar tde the crew",
            "nipsey hussle all money in the revenue",
            "nicki minaj queen the breakthrough",
            // --- Setup lines ---
            "tried and true with the breakthrough view",
            "black and blue with the bird's-eye view",
            "revenue from the avenue",
            "barbecue at the rendezvous",
            "imbue the hue of the residue",
            "misconstrue the overview due",
            "corkscrew on the honeydew",
            "kung fu with the bamboo crew",
            "shampoo at the igloo queue",
            "impromptu at the fondue brew",
            "bayou blue with the voodoo crew",
            "taboo breakthrough and the debut",
        ],
        dark: [
            "black and blue in the residue",
            "cold through and the dark avenue",
        ],
    },

    // ========================================================================
    // BATCH 1: MORE RAPPERS — ~80 entries
    // ========================================================================

    // --- Cam'ron / Ma$e / Fabolous (rhymes with 'on', 'ace', 'us') ---
    'amron': {
        all: [
            "pink fur dipset cam'ron",
            "harlem world ambassador cam'ron",
            "killa season on the cam'ron",
            "hey ma what's your plan cam'ron",
            // --- Setup lines ---
            "moving through the city like a marathon",
            "battle plan and i'm the paragon",
            "phenomenon in the pantheon",
        ],
    },

    'ase2': {
        all: [
            "harlem world shiny suit ma$e",
            "breathe stretch shake on the case ma$e",
            "feel so good at the base ma$e",
            "welcome back to the race ma$e",
            // --- Setup lines ---
            "catch me if you can in this rat race",
            "no trace left at the base",
            "straight ace never misplace",
        ],
    },

    'ulous': {
        all: [
            "breathe bars so fabulous",
            "you make me better fabolous",
            "trade it all for the glamorous fabolous",
            "brooklyn street cred so fabulous",
            // --- Setup lines ---
            "life is fabulous and miraculous",
            "stimulus from the calculus",
        ],
    },

    // --- Fat Joe / Big L / Jadakiss ---
    'oe': {
        all: [
            "lean back in the cadillac fat joe",
            "all the way up from the floor fat joe",
            "terror squad at the door fat joe",
            "make it rain let it flow fat joe",
            // --- Setup lines ---
            "running the show toe to toe",
            "let it go with the undertow",
            "overthrow the status quo",
            "quid pro quo on the patio",
        ],
    },

    'el': {
        all: [
            "harlem legend street dreams big l",
            "put it on and cast the spell big l",
            "mvp of the lyrical cartel big l",
            "ebonics redefine and excel big l",
            // --- Setup lines ---
            "clientele in the carousel",
            "parallel to the personnel",
            "sentinel at the citadel",
            "carousel by the wishing well",
        ],
    },

    'iss': {
        all: [
            "kiss of death from jadakiss",
            "why freestyle never miss jadakiss",
            "lox on the block pure bliss jadakiss",
            "top five dead or alive jadakiss",
            // --- Setup lines ---
            "reminisce on the genesis",
            "hit or miss in the abyss",
            "metamorphosis of this",
        ],
    },

    // --- The Game / E-40 / Coolio ---
    'aim': {
        all: [
            "three hundred bars the game",
            "how we do it in the hall of fame the game",
            "hate it or love it still claim the game",
            "compton king laid his claim the game",
            "red bandana in the flame the game",
            // --- Setup lines ---
            "hall of fame with the perfect aim",
            "fortune and fame in the picture frame",
            "overcame and reclaim the flame",
        ],
    },

    'orty': {
        all: [
            "choices yup thizzle e-40",
            "captain save is getting sporty e-40",
            "tell me when to go shorty e-40",
            "bay area slang from the forty e-40",
            // --- Setup lines ---
            "life of the party never sporty",
            "came up from the bottom at forty",
        ],
    },

    'olio': {
        all: [
            "gangsta's paradise coolio",
            "fantastic voyage portfolio coolio",
            "rollin' with my homies coolio",
            "c-u-when-you-get-there coolio",
            // --- Setup lines ---
            "folio in the portfolio",
            "polio never stopped the show",
        ],
    },

    // --- Biz Markie / Redman / Wiz Khalifa ---
    'arkie': {
        all: [
            "just a friend you got what i need biz markie",
            "clownin' on the beat biz markie",
            "beatbox king in the dark see biz markie",
            "vapors got you sparky biz markie",
            // --- Setup lines ---
            "hierarchy in the anarchy",
            "monarchy of the oligarchy",
        ],
    },

    'edman': {
        all: [
            "how high smoke the method redman",
            "funk doc in the building redman",
            "time for some action from the headman redman",
            "blackout with the plan redman",
            // --- Setup lines ---
            "deadman walking like a medman",
            "shredman better than the breadman",
        ],
    },

    'alifa': {
        all: [
            "see you again tears fall wiz khalifa",
            "black and yellow black and yellow wiz khalifa",
            "roll up blow smoke wiz khalifa",
            "taylor gang or die wiz khalifa",
            // --- Setup lines ---
            "no reefer like the khalifa",
            "believa in the diva khalifa",
        ],
    },

    // --- Run-DMC / LL Cool J / Salt-N-Pepa ---
    'mc': {
        all: [
            "it's tricky to rock a rhyme run-dmc",
            "walk this way adidas on the street run-dmc",
            "king of rock crowned the mc run-dmc",
            "my adidas fresh and clean run-dmc",
            // --- Setup lines ---
            "emcee of the century",
            "guarantee from the mc",
        ],
    },

    'oolj': {
        all: [
            "mama said knock you out ll cool j",
            "rock the bells on display ll cool j",
            "i'm bad no delay ll cool j",
            "going back to cali all day ll cool j",
            "around the way girl hooray ll cool j",
            // --- Setup lines ---
            "gourmet on the relay hooray",
            "ricochet on the runway bouquet",
        ],
    },

    'epa': {
        all: [
            "push it real good salt-n-pepa",
            "shoop there it is salt-n-pepa",
            "whatta man whatta mighty good man salt-n-pepa",
            "let's talk about the stepper salt-n-pepa",
            // --- Setup lines ---
            "step up like a pepper",
            "no one does it better",
        ],
    },

    // --- MC Lyte / Guru / Pete Rock / DJ Premier ---
    'yte': {
        all: [
            "cha cha cha on the mic mc lyte",
            "lyte as a rock and i'm tight mc lyte",
            "poor georgie story done right mc lyte",
            "ruffneck and the crowd ignite mc lyte",
            // --- Setup lines ---
            "satellite in the dynamite night",
            "hindsight in the oversight light",
        ],
    },

    'uru': {
        all: [
            "moment of truth gang starr guru",
            "gifted unlimited rhymes guru",
            "jazzmatazz the master guru",
            "above the clouds floating guru",
            // --- Setup lines ---
            "voodoo that the guru do",
            "kung fu through and through",
        ],
    },

    'erock': {
        all: [
            "they reminisce over you pete rock",
            "soul brother number one pete rock",
            "hip hop head to the bedrock pete rock",
            "sp twelve hundred on the block pete rock",
            // --- Setup lines ---
            "shamrock on the bedrock",
            "epoch of the gridlock",
        ],
    },

    'emier': {
        all: [
            "scratch master on the premier dj premier",
            "golden era no fear dj premier",
            "boom bap pioneer dj premier",
            "classic beats commandeer dj premier",
            // --- Setup lines ---
            "frontier of the premier career",
            "volunteer the auctioneer",
        ],
    },

    // --- Q-Tip / Phife Dawg ---
    'ip2': {
        all: [
            "can i kick it yes you can q-tip",
            "abstract poetics from the lip q-tip",
            "vivrant thing on the trip q-tip",
            "jazz hip hop fellowship q-tip",
            // --- Setup lines ---
            "spaceship and the rocket ship",
            "championship on the fingertip",
        ],
    },

    'awg': {
        all: [
            "five foot assassin phife dawg",
            "butter lyrics from the underdog phife dawg",
            "malik the five footer on the log phife dawg",
            // --- Setup lines ---
            "underdog in the catalogue",
            "analog dialogue in the fog",
        ],
    },

    // --- Del the Funky Homosapien / Aesop Rock / Talib Kweli ---
    'ien': {
        all: [
            "deltron zero the alien del the funky homosapien",
            "if you must rock the sapien del",
            "clint eastwood voice in the glen del",
            // --- Setup lines ---
            "alien in the meridian",
            "comedian in the custodian",
        ],
    },

    'esop': {
        all: [
            "none shall pass the aesop aesop rock",
            "daylight shining on the block aesop rock",
            "labor days from the dock aesop rock",
            // --- Setup lines ---
            "nonstop to the treetop rock",
            "workshop on the rooftop clock",
        ],
    },

    'eli': {
        all: [
            "get by just to get by talib kweli",
            "quality lyrics from the belly talib kweli",
            "black star shining steadily talib kweli",
            "conscious flow incredibly talib kweli",
            // --- Setup lines ---
            "medley of the melody",
            "readily and steadily",
        ],
    },

    // --- Black Thought / Royce da 5'9" ---
    'ought': {
        all: [
            "ten minutes freestyle black thought",
            "illadelph halflife black thought",
            "the roots run deep black thought",
            "bars so heavy can't be bought black thought",
            // --- Setup lines ---
            "afterthought in the onslaught",
            "forethought never overwrought",
            "distraught but never caught",
        ],
    },

    'oyce': {
        all: [
            "boom bars from the voice royce da five nine",
            "prhyme time with the choice royce da five nine",
            "book of ryan rejoice royce da five nine",
            "lyrically precise by choice royce da five nine",
            // --- Setup lines ---
            "rolls royce with the voice",
            "rejoice with the right choice",
        ],
    },

    // --- Joyner Lucas / Token / Hopsin ---
    'ucas': {
        all: [
            "i'm not racist face the mucus joyner lucas",
            "adhd off the nucleus joyner lucas",
            "will bars go medusa joyner lucas",
            "ross capicchioni produce us joyner lucas",
            // --- Setup lines ---
            "abacus of the ruckus",
            "hibiscus in the mucus",
        ],
    },

    'opsin': {
        all: [
            "ill mind of hopsin the toxin hopsin",
            "no words flow like the doctrine hopsin",
            "fly calling out the nonsense hopsin",
            "sag my pants and the box in hopsin",
            // --- Setup lines ---
            "toxin in the locksin",
            "droppin' knowledge nonstoppin'",
        ],
    },

    // --- Machine Gun Kelly / Lil Yachty / Lil Uzi Vert ---
    'elly': {
        all: [
            "rap devil on the telly machine gun kelly",
            "wild boy shaking the jelly machine gun kelly",
            "est four life belly machine gun kelly",
            "cleveland to the deli machine gun kelly",
            // --- Setup lines ---
            "belly of the beast in the deli",
            "machiavelli on the telly",
        ],
    },

    'achty': {
        all: [
            "one night on the yacht lil yachty",
            "minnesota cold and catchy lil yachty",
            "broccoli bars are patchy lil yachty",
            "sailing team never snatchy lil yachty",
            // --- Setup lines ---
            "scratchy and the catchy",
            "patchy on the natchy",
        ],
    },

    'vert': {
        all: [
            "xo tour life alert lil uzi vert",
            "eternal atake divert lil uzi vert",
            "money longer introvert lil uzi vert",
            "futsal shuffle and convert lil uzi vert",
            // --- Setup lines ---
            "introvert to the extrovert",
            "concert on the high alert",
            "assert and reassert",
        ],
    },

    // --- Playboi Carti / Young Thug ---
    'arti': {
        all: [
            "magnolia slime and the party playboi carti",
            "whole lotta red departed playboi carti",
            "vamp anthem and the smarty playboi carti",
            // --- Setup lines ---
            "party like a bacardi",
            "started from the smarty party",
        ],
    },

    'ug2': {
        all: [
            "lifestyle of the rich young thug",
            "digits on the plug young thug",
            "best friend with the slug young thug",
            "hot remix and the drug young thug",
            // --- Setup lines ---
            "unplug from the jitterbug",
            "snug as a bug in a rug",
        ],
    },

    // --- Quavo / Offset / Takeoff ---
    'avo': {
        all: [
            "bad and boujee bravo quavo",
            "ice tray bravado quavo",
            "huncho jack commando quavo",
            "walk it like i talk it bravo quavo",
            // --- Setup lines ---
            "bravado of the desperado",
            "el dorado in the avocado",
        ],
    },

    'offset': {
        all: [
            "ric flair drip never upset offset",
            "clout goggles on the asset offset",
            "father of four mindset offset",
            // --- Setup lines ---
            "onset of the sunset offset",
            "mindset on the asset set",
        ],
    },

    'eoff': {
        all: [
            "last memory the liftoff takeoff",
            "rocket flow and the payoff takeoff",
            "migos trippin on the standoff takeoff",
            // --- Setup lines ---
            "standoff at the playoff",
            "tradeoff for the payoff",
        ],
    },

    // --- Lil Pump / Kodak Black / DaBaby ---
    'ump': {
        all: [
            "gucci gang on the jump lil pump",
            "esketit and the bump lil pump",
            "d rose for the pump lil pump",
            // --- Setup lines ---
            "pump up the volume trump",
            "no slump in the dump",
        ],
    },

    'odak': {
        all: [
            "tunnel vision kodak black",
            "zeze on the soundtrack kodak black",
            "roll in peace on the track kodak black",
            "no flockin' on the attack kodak black",
            // --- Setup lines ---
            "zodiac on the comeback",
            "setback to the feedback",
        ],
    },

    'aby': {
        all: [
            "suge knight bars go crazy dababy",
            "bop on the beat maybe dababy",
            "rockstar and it ain't lazy dababy",
            "practice making hits daily dababy",
            // --- Setup lines ---
            "baby on the gravy maybe",
            "maybe it's the navy baby",
        ],
    },

    // --- Roddy Ricch / Jack Harlow / Cordae ---
    'icch': {
        all: [
            "the box hit the switch roddy ricch",
            "every season getting rich roddy ricch",
            "ballin' through the stitch roddy ricch",
            "high fashion in the niche roddy ricch",
            // --- Setup lines ---
            "glitch in the matrix switch",
            "witch on the broomstick pitch",
        ],
    },

    'arlow': {
        all: [
            "first class on the sparrow jack harlow",
            "whats poppin in the narrow jack harlow",
            "louisville kid on the arrow jack harlow",
            "industry plant or the pharaoh jack harlow",
            // --- Setup lines ---
            "narrow the gap like a sparrow",
            "arrow through the marrow",
        ],
    },

    'ordae': {
        all: [
            "lost boy found the way cordae",
            "have mercy on the play cordae",
            "super lyrics on display cordae",
            "ybn to the new day cordae",
            // --- Setup lines ---
            "soiree on the parfait",
            "risque on the croquet",
        ],
    },

    // --- JID / Ski Mask / Denzel Curry ---
    'id2': {
        all: [
            "never story on the grid jid",
            "the forever story amid jid",
            "surpass and you can't forbid jid",
            "dicaprio two the kid jid",
            // --- Setup lines ---
            "pyramid on the grid",
            "underbid in the mid",
        ],
    },

    'ask2': {
        all: [
            "catch me outside with the flask ski mask",
            "faucet failure on the task ski mask",
            "stokeley unmasked ski mask",
            "slump god behind the mask ski mask",
            // --- Setup lines ---
            "bask in the aftermath and ask",
            "multitask in the flask",
        ],
    },

    'urry': {
        all: [
            "ultimate flow in a hurry denzel curry",
            "clout cobain no worry denzel curry",
            "bulls on parade in a flurry denzel curry",
            "taboo walkin with no worry denzel curry",
            // --- Setup lines ---
            "fury in a hurry with the curry",
            "scurry through the flurry",
        ],
    },

    // --- Rico Nasty / 6ix9ine / YNW Melly ---
    'asty': {
        all: [
            "smack a hater nasty rico nasty",
            "kenergy in the dynasty rico nasty",
            "rage music got me blasting rico nasty",
            // --- Setup lines ---
            "tasty in the dynasty",
            "hasty and the fantasy",
        ],
    },

    'ine2': {
        all: [
            "rainbow grill and the vine 6ix9ine",
            "gummo on the bottom line 6ix9ine",
            "trolling every single time 6ix9ine",
            "kooda down the pipeline 6ix9ine",
            // --- Setup lines ---
            "headline on the grapevine",
            "sunshine on the borderline",
        ],
    },

    'elly2': {
        all: [
            "murder on my mind like jelly ynw melly",
            "mixed personalities and the belly ynw melly",
            "suicidal thoughts from the telly ynw melly",
            // --- Setup lines ---
            "belly full of vermicelli",
            "jelly on the machete deli",
        ],
    },

    // --- NBA YoungBoy / Moneybagg Yo / Gucci Mane ---
    'oungboy': {
        all: [
            "outside today on the convoy nba youngboy",
            "no smoke with the decoy nba youngboy",
            "bandit flow from the real mccoy nba youngboy",
            "valuable pain ain't no ploy nba youngboy",
            // --- Setup lines ---
            "decoy of the golden boy",
            "killjoy or the real mccoy",
        ],
    },

    'aggyo': {
        all: [
            "time today in the bravado moneybagg yo",
            "said sum on the patio moneybagg yo",
            "wockesha flowing amigo moneybagg yo",
            // --- Setup lines ---
            "desperado on the patio",
            "bravado in the avocado",
        ],
    },

    'ane2': {
        all: [
            "lemonade and the rain gucci mane",
            "trap house in the lane gucci mane",
            "wasted flow and the chain gucci mane",
            "brrr icy on the brain gucci mane",
            "first day out the domain gucci mane",
            // --- Setup lines ---
            "hurricane in the fast lane",
            "membrane of the campaign",
            "champagne on the cellophane",
        ],
    },

    // --- Bone Thugs-N-Harmony / Three 6 Mafia ---
    'armony': {
        all: [
            "tha crossroads harmony bone thugs-n-harmony",
            "first of tha month in the colony bone thugs",
            "thuggish ruggish in the ceremony bone thugs",
            "east 1999 eternal testimony bone thugs",
            // --- Setup lines ---
            "harmony in the philharmony",
            "ceremony of the testimony",
        ],
    },

    'afia': {
        all: [
            "stay fly on the mafia three 6 mafia",
            "sippin on some syrup lafia three 6 mafia",
            "poppin my collar with the trivia three 6 mafia",
            "oscar winning for the mafia three 6 mafia",
            // --- Setup lines ---
            "mafia in the cafeteria",
            "trivia from the criteria",
        ],
    },

    // --- UGK / Pimp C / Bun B ---
    'impc': {
        all: [
            "international players pimp c",
            "pocket full of stones on the spree pimp c",
            "ridin dirty down in tennessee pimp c",
            "sweet jones the degree pimp c",
            // --- Setup lines ---
            "decree of the emcee",
            "guarantee of the jubilee",
        ],
    },

    'unb': {
        all: [
            "trill og with the flow bun b",
            "ugk for life decree bun b",
            "draped up and dripped out free bun b",
            "get throwed and you'll see bun b",
            // --- Setup lines ---
            "epiphany of the guarantee",
            "recipe from the refugee",
        ],
    },

    // --- Lil Flip / Paul Wall / Slim Thug ---
    'ip3': {
        all: [
            "game over flip the script lil flip",
            "sunshine from the grip lil flip",
            "this is the way we ball equip lil flip",
            // --- Setup lines ---
            "battleship on the fellowship",
            "scholarship of the courtship",
        ],
    },

    'all2': {
        all: [
            "sittin sideways on the wall paul wall",
            "grillz shining down the hall paul wall",
            "break em off a piece and brawl paul wall",
            "people's champ standing tall paul wall",
            // --- Setup lines ---
            "waterfall in the banquet hall",
            "free fall with the curtain call",
            "cannonball at the carnival",
        ],
    },

    'ug3': {
        all: [
            "already platinum no bug slim thug",
            "i run the south no shrug slim thug",
            "like a boss with the plug slim thug",
            "houston hot as a mug slim thug",
            // --- Setup lines ---
            "firebug in the humbug",
            "ladybug on the jitterbug rug",
        ],
    },

    // --- Chamillionaire / Master P / Birdman / Mannie Fresh ---
    'aire': {
        all: [
            "ridin dirty in the air chamillionaire",
            "turn it up millionaire chamillionaire",
            "hip hop police beware chamillionaire",
            "evening news debonaire chamillionaire",
            // --- Setup lines ---
            "millionaire debonaire in the chair",
            "solitaire in the thoroughfare",
            "questionnaire for the billionaire",
        ],
    },

    'asterp': {
        all: [
            "make em say uhh the master master p",
            "no limit soldiers on the spree master p",
            "bout it bout it decree master p",
            "ice cream man guarantee master p",
            "ghetto d the recipe master p",
            // --- Setup lines ---
            "masterly and the catastrophe free",
            "artistry of the mystery",
        ],
    },

    'irdman': {
        all: [
            "put some respeck on my name birdman",
            "number one stunna birdman",
            "cash money empire birdman",
            "hand rub like the plan birdman",
            // --- Setup lines ---
            "wingspan of the birdman clan",
            "herdsman on the overland",
        ],
    },

    'resh': {
        all: [
            "real big beat so fresh mannie fresh",
            "ladies night and the mesh mannie fresh",
            "bounce music from the desk mannie fresh",
            "cash money sound refresh mannie fresh",
            // --- Setup lines ---
            "refresh and the enmesh",
            "flesh on the thresh",
        ],
    },

    // ========================================================================
    // BATCH 2: MORE MUSICIANS — ~80 entries
    // ========================================================================

    // --- Ray Charles / Sam Cooke / Tina Turner ---
    'arles': {
        all: [
            "hit the road jack no quarrels ray charles",
            "georgia on my mind ray charles",
            "i got a woman in the snarls ray charles",
            "unchain my heart the annals ray charles",
            // --- Setup lines ---
            "memorials in the laurels",
            "orals of the chorales",
        ],
    },

    'ooke': {
        all: [
            "a change is gonna come and look sam cooke",
            "cupid draw back your hook sam cooke",
            "twistin' the night away by the brook sam cooke",
            "bring it on home and cook sam cooke",
            // --- Setup lines ---
            "by hook or by crook we shook",
            "overlooked what the good book took",
        ],
    },

    'urner': {
        all: [
            "simply the best no learner tina turner",
            "proud mary keep on burning tina turner",
            "what's love got to do with the burner tina turner",
            "river deep mountain high the earner tina turner",
            "private dancer the discerner tina turner",
            // --- Setup lines ---
            "earner and the slow burner",
            "no turner in the forerunner",
        ],
    },

    // --- John Lennon / Paul McCartney / Mick Jagger ---
    'ennon': {
        all: [
            "imagine all the people john lennon",
            "instant karma john lennon",
            "give peace a chance john lennon",
            "working class hero in the denon john lennon",
            // --- Setup lines ---
            "pennant on the antenna venom",
            "tenon in the phenomenon",
        ],
    },

    'artney': {
        all: [
            "yesterday all my troubles paul mccartney",
            "let it be paul mccartney",
            "live and let die heartily paul mccartney",
            "maybe i'm amazed smartly paul mccartney",
            // --- Setup lines ---
            "tartly in the courtney",
            "partnered with the journey",
        ],
    },

    'agger': {
        all: [
            "satisfaction never stagger mick jagger",
            "moves like jagger on the swagger mick jagger",
            "sympathy for the devil dagger mick jagger",
            "paint it black with the swagger mick jagger",
            "start me up no matter mick jagger",
            // --- Setup lines ---
            "swagger of the dagger",
            "stagger in theagger",
        ],
    },

    // --- David Bowie / Freddie Mercury / Elvis Presley ---
    'owie': {
        all: [
            "starman waiting in the sky david bowie",
            "ziggy stardust the showy david bowie",
            "under pressure and the snowy david bowie",
            "changes turn and face the david bowie",
            // --- Setup lines ---
            "snowy and the showy",
            "blowy on the shadowy",
        ],
    },

    'ercury': {
        all: [
            "bohemian rhapsody mercury freddie mercury",
            "we are the champions in the luxury freddie mercury",
            "somebody to love the treasury freddie mercury",
            "don't stop me now with the mercury freddie mercury",
            "i want to break free the mercury freddie mercury",
            // --- Setup lines ---
            "mercury rising in the treasury",
            "incendiary of the mercenary",
        ],
    },

    'esley': {
        all: [
            "jailhouse rock impressively elvis presley",
            "hound dog aggressively elvis presley",
            "can't help falling in love expressly elvis presley",
            "suspicious minds obsessively elvis presley",
            "the king of rock excessively elvis presley",
            // --- Setup lines ---
            "expressly and the wesley",
            "impressively and obsessively",
        ],
    },

    // --- Jimi Hendrix / Bob Dylan ---
    'endrix': {
        all: [
            "purple haze fix the mix jimi hendrix",
            "voodoo child appendix jimi hendrix",
            "all along the watchtower hendrix",
            "crosstown traffic in the matrix hendrix",
            // --- Setup lines ---
            "appendix of the phoenix",
            "matrix of the analytics",
        ],
    },

    'ylan': {
        all: [
            "times they are a-changing bob dylan",
            "blowin in the wind like bob dylan",
            "like a rolling stone bob dylan",
            "tangled up in blue villain bob dylan",
            // --- Setup lines ---
            "villain on the penicillin",
            "chillin' like a civilian",
        ],
    },

    // --- Frank Sinatra / Ella Fitzgerald / Louis Armstrong ---
    'atra': {
        all: [
            "did it my way mantra frank sinatra",
            "fly me to the moon sinatra",
            "new york new york the mantra frank sinatra",
            "the best is yet to come sinatra",
            // --- Setup lines ---
            "mantra of the tantra",
            "sinatra in the plethora",
        ],
    },

    'erald': {
        all: [
            "a-tisket a-tasket ella fitzgerald",
            "summertime living herald ella fitzgerald",
            "dream a little dream emerald ella fitzgerald",
            "every time we say goodbye fitzgerald",
            // --- Setup lines ---
            "herald of the emerald",
            "geraldo in the herald",
        ],
    },

    'rong': {
        all: [
            "what a wonderful world strong louis armstrong",
            "hello dolly all along louis armstrong",
            "when the saints go marching long louis armstrong",
            "satchmo blowing lifelong louis armstrong",
            // --- Setup lines ---
            "headstrong in the prong",
            "lifelong in the singalong song",
        ],
    },

    // --- Miles Davis ---
    'avis': {
        all: [
            "kind of blue the travis miles davis",
            "bitches brew no mavis miles davis",
            "so what on the davis miles davis",
            "cool jazz from the oasis miles davis",
            // --- Setup lines ---
            "travis in the davis",
            "enclaves of the braves",
        ],
    },

    // --- SZA / Erykah Badu / Amy Winehouse ---
    'za': {
        all: [
            "kill bill on the plaza sza",
            "good days coming piazza sza",
            "love galore the extravaganza sza",
            "ctrl of the bonanza sza",
            // --- Setup lines ---
            "plaza at the piazza",
            "bonanza of the extravaganza",
        ],
    },

    'adu': {
        all: [
            "on and on the voodoo erykah badu",
            "tyrone go call your crew erykah badu",
            "bag lady breakthrough erykah badu",
            "next lifetime the guru erykah badu",
            "window seat debut erykah badu",
            // --- Setup lines ---
            "voodoo that the guru do badu",
            "taboo of the kung fu",
        ],
    },

    'ehouse': {
        all: [
            "rehab no no no the playhouse amy winehouse",
            "back to black in the storehouse amy winehouse",
            "valerie call the firehouse amy winehouse",
            "you know i'm no good in the dollhouse amy winehouse",
            // --- Setup lines ---
            "powerhouse in the penthouse",
            "warehouse to the lighthouse",
        ],
    },

    // --- Luther Vandross / Mary J. Blige / Teddy Pendergrass ---
    'oss2': {
        all: [
            "never too much the boss luther vandross",
            "here and now no loss luther vandross",
            "dance with my father across luther vandross",
            "always and forever the cross luther vandross",
            // --- Setup lines ---
            "albatross and the lacrosse",
            "criss-cross on the moss",
        ],
    },

    'ige': {
        all: [
            "no more drama on the bridge mary j. blige",
            "real love not the privilege mary j. blige",
            "family affair with the sacrilege mary j. blige",
            "be without you not the image mary j. blige",
            // --- Setup lines ---
            "privilege of the scrimmage",
            "pilgrimage to the village",
        ],
    },

    'ass2': {
        all: [
            "close the door first class teddy pendergrass",
            "turn off the lights amass teddy pendergrass",
            "love tko no bypass teddy pendergrass",
            // --- Setup lines ---
            "hourglass in the overpass",
            "looking glass on the underpass",
        ],
    },

    // --- Patti LaBelle / Chaka Khan / Gladys Knight ---
    'elle2': {
        all: [
            "lady marmalade oh well patti labelle",
            "new attitude excelle patti labelle",
            "if only you knew gazelle patti labelle",
            "on my own carousel patti labelle",
            // --- Setup lines ---
            "gazelle at the carousel",
            "mademoiselle in the citadel",
        ],
    },

    'an2': {
        all: [
            "i'm every woman the plan chaka khan",
            "through the fire caravan chaka khan",
            "ain't nobody the clan chaka khan",
            "i feel for you japan chaka khan",
            // --- Setup lines ---
            "caravan in the japan",
            "clan of the masterplan",
        ],
    },

    'ight2': {
        all: [
            "midnight train the spotlight gladys knight",
            "neither one of us the moonlight gladys knight",
            "best thing that ever happened alright gladys knight",
            "license to kill the twilight gladys knight",
            // --- Setup lines ---
            "oversight in the spotlight",
            "midnight in the copyright",
        ],
    },

    // --- Lionel Richie / Rick James / George Clinton ---
    'ichie': {
        all: [
            "all night long and it's ritchie lionel richie",
            "hello is it me you're looking for richie lionel richie",
            "dancing on the ceiling quickly lionel richie",
            "say you say me and the trickery lionel richie",
            // --- Setup lines ---
            "witchery and the trickery richie",
            "stitchery in the glitchery",
        ],
    },

    'ames2': {
        all: [
            "super freak got no shame rick james",
            "give it to me baby no blame rick james",
            "she's a super freak the flame rick james",
            "cold blooded in the frame rick james",
            "unity in the game rick james",
            // --- Setup lines ---
            "hall of fame with the flames",
            "picture frames and the claims",
        ],
    },

    'inton': {
        all: [
            "atomic dog in the kitten george clinton",
            "one nation under a groove mitten george clinton",
            "flashlight in the smitten george clinton",
            "parliament funk and the written george clinton",
            // --- Setup lines ---
            "smitten like a kitten",
            "written and the mitten bitten",
        ],
    },

    // --- Bootsy Collins / Sly Stone / James Brown ---
    'ollins': {
        all: [
            "i'd rather be with you bootsy collins",
            "bootzilla on the goblins bootsy collins",
            "space bass in the collins bootsy collins",
            "funk it up the problems bootsy collins",
            // --- Setup lines ---
            "goblins in the columns",
            "collins of the solemn columns",
        ],
    },

    'tone': {
        all: [
            "everyday people on the phone sly stone",
            "family affair to the bone sly stone",
            "dance to the music alone sly stone",
            "stand on the cornerstone sly stone",
            "thank you for the milestone sly stone",
            // --- Setup lines ---
            "cornerstone of the milestone",
            "telephone to the megaphone tone",
        ],
    },

    'rown2': {
        all: [
            "i feel good in the town james brown",
            "get up on the good foot around james brown",
            "living in america the sound james brown",
            "payback coming 'round james brown",
            "it's a man's world crowned james brown",
            "sex machine gettin' down james brown",
            // --- Setup lines ---
            "renown from the background",
            "showdown in the downtown",
        ],
    },

    // --- Smokey Robinson / Temptations / Four Tops ---
    'obinson': {
        all: [
            "tracks of my tears the permission smokey robinson",
            "cruisin' on a mission smokey robinson",
            "ooh baby baby the vision smokey robinson",
            "you've really got a hold my admission smokey robinson",
            // --- Setup lines ---
            "permission of the admission",
            "commission in the submission",
        ],
    },

    'ations': {
        all: [
            "my girl in the temptations the temptations",
            "ain't too proud to beg foundations temptations",
            "just my imagination temptations",
            "papa was a rolling stone the temptations",
            // --- Setup lines ---
            "foundations of the generations",
            "sensations of the celebrations",
        ],
    },

    'ops': {
        all: [
            "i can't help myself the props four tops",
            "reach out i'll be there no stops four tops",
            "standing in the shadows the crops four tops",
            "bernadette and the nonstop four tops",
            // --- Setup lines ---
            "rooftops to the treetops",
            "nonstops and the workshops",
        ],
    },

    // --- Isley Brothers / Commodores / Jackson 5 ---
    'sley': {
        all: [
            "shout and twist and shimmy isley brothers",
            "between the sheets no measly isley brothers",
            "it's your thing easily isley brothers",
            "that lady breezy and the isley brothers",
            // --- Setup lines ---
            "easily and the breezy",
            "measly to the weasley",
        ],
    },

    'ores': {
        all: [
            "easy like sunday morning with the scores commodores",
            "brick house building more commodores",
            "three times a lady in the stores commodores",
            "nightshift working floors commodores",
            // --- Setup lines ---
            "outscores on the dance floors",
            "encore with the commodores",
        ],
    },

    'ive': {
        all: [
            "abc easy as one two the hive jackson 5",
            "i want you back alive jackson 5",
            "i'll be there to survive jackson 5",
            "rockin' robin thrive jackson 5",
            // --- Setup lines ---
            "high five to the archive",
            "beehive on the overdrive",
        ],
    },

    // --- Boyz II Men / TLC / Destiny's Child ---
    'en2': {
        all: [
            "end of the road again boyz ii men",
            "i'll make love to you then boyz ii men",
            "motownphilly back again boyz ii men",
            "on bended knee amen boyz ii men",
            "water runs dry zen boyz ii men",
            // --- Setup lines ---
            "amen and then again",
            "citizen of the zen den",
        ],
    },

    'lc': {
        all: [
            "no scrubs and the alchemy tlc",
            "waterfalls and the policy tlc",
            "creep on the legacy tlc",
            "unpretty but the majesty tlc",
            // --- Setup lines ---
            "policy of the legacy",
            "prophecy of the agency",
        ],
    },

    'ild': {
        all: [
            "say my name wild destiny's child",
            "survivor and compiled destiny's child",
            "independent women filed destiny's child",
            "bills bills bills reconciled destiny's child",
            "bootylicious and the styled destiny's child",
            // --- Setup lines ---
            "reconciled in the wild",
            "compiled and the beguiled",
        ],
    },

    // --- En Vogue / Aaliyah / Left Eye / Lauryn Hill / Fugees ---
    'ogue': {
        all: [
            "free your mind the vogue en vogue",
            "hold on the prologue en vogue",
            "my lovin' never gonna get the rogue en vogue",
            "don't let go the epilogue en vogue",
            // --- Setup lines ---
            "prologue to the epilogue",
            "catalogue in the travelogue",
        ],
    },

    'iyah': {
        all: [
            "try again messiah aaliyah",
            "one in a million pariah aaliyah",
            "are you that somebody via aaliyah",
            "rock the boat with the dia aaliyah",
            "age ain't nothing but a number aaliyah",
            // --- Setup lines ---
            "messiah in the maya",
            "pariah of the sophia",
        ],
    },

    'eye': {
        all: [
            "don't go chasing waterfalls the eye left eye",
            "no scrubs in disguise left eye",
            "crazy sexy cool supply left eye",
            "burning down the alibi left eye",
            // --- Setup lines ---
            "bird's eye in the bull's eye",
            "alibi of the samurai",
        ],
    },

    'ill2': {
        all: [
            "doo wop that thing the thrill lauryn hill",
            "killing me softly fulfill lauryn hill",
            "everything is everything still lauryn hill",
            "miseducation at the windowsill lauryn hill",
            "lost ones on the hill lauryn hill",
            "ex-factor on the skill lauryn hill",
            // --- Setup lines ---
            "windowsill of the goodwill",
            "fulfill the drill until",
        ],
    },

    'ugees': {
        all: [
            "killing me softly refugees the fugees",
            "ready or not the degrees the fugees",
            "fu gee la overseas the fugees",
            "vocab on the expertise the fugees",
            // --- Setup lines ---
            "refugees with the expertise",
            "degrees of the overseas fees",
        ],
    },

    // --- Dolly Parton / Willie Nelson / Billie Holiday ---
    'arton': {
        all: [
            "nine to five in the carton dolly parton",
            "jolene from the garden dolly parton",
            "i will always love you dolly parton",
            "coat of many colors the spartan dolly parton",
            // --- Setup lines ---
            "carton in the garden",
            "spartan with the pardon",
        ],
    },

    'elson': {
        all: [
            "on the road again willie nelson",
            "always on my mind the felon willie nelson",
            "blue eyes crying in the melon willie nelson",
            "whiskey river the skeleton willie nelson",
            // --- Setup lines ---
            "skeleton of the melon",
            "felon in the rebellion",
        ],
    },

    'oliday': {
        all: [
            "strange fruit on the holiday billie holiday",
            "god bless the child everyday billie holiday",
            "all of me the matinee billie holiday",
            "gloomy sunday the hideaway billie holiday",
            // --- Setup lines ---
            "holiday in the hideaway",
            "matinee on the getaway",
        ],
    },

    // --- Nina Simone / Otis Redding / Al Green ---
    'imone': {
        all: [
            "feeling good on the throne nina simone",
            "i put a spell on the phone nina simone",
            "mississippi goddam the zone nina simone",
            "ain't got no life alone nina simone",
            // --- Setup lines ---
            "throne to the microphone",
            "milestone in the cornerstone zone",
        ],
    },

    'edding': {
        all: [
            "sitting on the dock the wedding otis redding",
            "try a little tenderness the heading otis redding",
            "these arms of mine the spreading otis redding",
            "respect the original otis redding",
            // --- Setup lines ---
            "heading to the wedding",
            "spreading on the bedding",
        ],
    },

    'een2': {
        all: [
            "let's stay together on the scene al green",
            "love and happiness the dream al green",
            "tired of being alone the green al green",
            "here i am the evergreen al green",
            // --- Setup lines ---
            "evergreen on the movie screen",
            "figurine of the tangerine keen",
        ],
    },

    // --- Barry White / Keith Sweat ---
    'ite2': {
        all: [
            "can't get enough of the light barry white",
            "you're the first the last the right barry white",
            "practice what you preach the might barry white",
            "never gonna give you up the sight barry white",
            // --- Setup lines ---
            "dynamite in the satellite flight",
            "oversight in the copyright might",
        ],
    },

    'eat2': {
        all: [
            "make it last forever on the beat keith sweat",
            "twisted in the heat keith sweat",
            "nobody on the street keith sweat",
            "i want her the discreet keith sweat",
            // --- Setup lines ---
            "bittersweet on the concrete",
            "heartbeat on the deadbeat street",
        ],
    },

    // --- Earth Wind & Fire ---
    'ire2': {
        all: [
            "september remember the fire earth wind and fire",
            "let's groove the empire earth wind and fire",
            "shining star never tire earth wind and fire",
            "boogie wonderland entire earth wind and fire",
            "after the love the pyre earth wind and fire",
            // --- Setup lines ---
            "empire of the hellfire",
            "crossfire on the highwire",
        ],
    },

    // ========================================================================
    // BATCH 3: ACTORS — ~80 entries
    // ========================================================================

    // --- Leonardo DiCaprio / Jack Nicholson ---
    'aprio': {
        all: [
            "oscar finally in the scenario dicaprio",
            "wolf of wall street cheerio dicaprio",
            "titanic king of the ratio dicaprio",
            "departed from the patio dicaprio",
            "inception dream the trio dicaprio",
            // --- Setup lines ---
            "scenario in the ratio",
            "cheerio from the patio",
        ],
    },

    'olson': {
        all: [
            "here's johnny in the column jack nicholson",
            "the shining frozen colson jack nicholson",
            "you can't handle the truth jack nicholson",
            "as good as it gets the colosseum jack nicholson",
            "one flew over the cuckoo jack nicholson",
            // --- Setup lines ---
            "colson in the wilson",
            "folsom on the wholesomen",
        ],
    },

    // --- Tom Hanks / Jim Carrey / Robin Williams ---
    'anks': {
        all: [
            "life is like a box of chocolates thanks tom hanks",
            "castaway on the banks tom hanks",
            "houston we have a problem the ranks tom hanks",
            "saving private ryan the tanks tom hanks",
            "forrest gump running past the flanks tom hanks",
            // --- Setup lines ---
            "outranks and the banks",
            "point blank at the flanks",
        ],
    },

    'arrey': {
        all: [
            "alrighty then the parlay jim carrey",
            "somebody stop me and carry jim carrey",
            "the mask is on and it's scary jim carrey",
            "liar liar never vary jim carrey",
            "ace ventura legendary jim carrey",
            // --- Setup lines ---
            "legendary and it's scary",
            "ordinary to extraordinary",
        ],
    },

    'illiams': {
        all: [
            "good morning vietnam no qualms robin williams",
            "genie of the lamp the realms robin williams",
            "good will hunting overwhelms robin williams",
            "dead poets society the films robin williams",
            "mrs. doubtfire in the realms robin williams",
            // --- Setup lines ---
            "overwhelms in the realms",
            "at the helms of the films",
        ],
    },

    // --- Martin Lawrence / Chris Tucker / Kevin Hart ---
    'awrence': {
        all: [
            "you so crazy with the warrants martin lawrence",
            "bad boys for life the florence martin lawrence",
            "big momma's house the abhorrence martin lawrence",
            "run tell dat the torrents martin lawrence",
            // --- Setup lines ---
            "florence of the abhorrence",
            "torrents in the warrants",
        ],
    },

    'ucker': {
        all: [
            "do you understand the words the trucker chris tucker",
            "rush hour nothing to duck her chris tucker",
            "friday and i got knocked the sucker chris tucker",
            "you got knocked out the motherducker chris tucker",
            "fifth element the lucky trucker chris tucker",
            // --- Setup lines ---
            "trucker on the firecracker",
            "sucker punch the mothertrucker",
        ],
    },

    'art2': {
        all: [
            "let me explain from the heart kevin hart",
            "ride along and be smart kevin hart",
            "think like a man the head start kevin hart",
            "short king standing tall and apart kevin hart",
            "irresponsible that's the art kevin hart",
            // --- Setup lines ---
            "head start from the go-kart",
            "sweetheart on the counterpart",
        ],
    },

    // --- Harrison Ford / Halle Berry / Viola Davis ---
    'ord': {
        all: [
            "indiana jones the record harrison ford",
            "han solo never bored harrison ford",
            "blade runner the accord harrison ford",
            "get off my plane the sword harrison ford",
            // --- Setup lines ---
            "accord and the record lord",
            "discord on the landlord",
        ],
    },

    'erry': {
        all: [
            "monster's ball the cherry halle berry",
            "catwoman on the ferry halle berry",
            "oscar first the legendary halle berry",
            "storm of the x-men berry halle berry",
            // --- Setup lines ---
            "legendary on the ferry",
            "cherry on the missionary",
        ],
    },

    'avis2': {
        all: [
            "how to get away the davis viola davis",
            "fences breaking all the mavis viola davis",
            "the help and the enclaves viola davis",
            "queen supreme no caveats viola davis",
            // --- Setup lines ---
            "davis of the enclaves",
            "mavis in the archives",
        ],
    },

    // --- Scarlett Johansson / Uma Thurman ---
    'ansson': {
        all: [
            "black widow on the ransom scarlett johansson",
            "lost in translation the handsome scarlett johansson",
            "avenger on the expansion scarlett johansson",
            // --- Setup lines ---
            "ransom in the mansion",
            "handsome with the expansion",
        ],
    },

    'urman': {
        all: [
            "kill bill and the sermon uma thurman",
            "bride yellow tracksuit the german uma thurman",
            "pulp fiction twist and the firman uma thurman",
            "gogo yubari on the doorman uma thurman",
            // --- Setup lines ---
            "sermon from the german",
            "firman of the doorman",
        ],
    },

    // --- Jet Li / Jean-Claude Van Damme / Sean Connery ---
    'etli': {
        all: [
            "the one and only confetti jet li",
            "fearless with the machete jet li",
            "hero of the spaghetti jet li",
            "unleashed and ready jet li",
            // --- Setup lines ---
            "machete on the confetti",
            "spaghetti on the serengeti",
        ],
    },

    'amme': {
        all: [
            "timecop in the program jean-claude van damme",
            "bloodsport and the slam jean-claude van damme",
            "kickboxer on the exam jean-claude van damme",
            "splits between the jam van damme",
            "universal soldier damn van damme",
            // --- Setup lines ---
            "telegram in the diagram",
            "amsterdam on the anagram",
        ],
    },

    'onnery': {
        all: [
            "bond james bond the gunnery sean connery",
            "the rock on the refinery sean connery",
            "untouchables the machinery sean connery",
            "shaken not stirred the nunnery sean connery",
            // --- Setup lines ---
            "gunnery in the nunnery",
            "machinery of the refinery",
        ],
    },

    // --- John Travolta / Nicolas Cage ---
    'olta': {
        all: [
            "staying alive the volta john travolta",
            "pulp fiction twist and the volta john travolta",
            "grease lightning the volta john travolta",
            "saturday night fever the volta john travolta",
            // --- Setup lines ---
            "volta in the ricotta",
            "iota of the quota",
        ],
    },

    'age2': {
        all: [
            "face off on the stage nicolas cage",
            "gone in sixty seconds the rampage nicolas cage",
            "national treasure the cage nicolas cage",
            "con air on the front page nicolas cage",
            "the wicker man outrage nicolas cage",
            // --- Setup lines ---
            "rampage on the front page",
            "backstage to the center stage",
        ],
    },

    // --- Liam Neeson / Matt Damon / Mark Wahlberg ---
    'eeson': {
        all: [
            "particular set of skills the reason liam neeson",
            "i will find you in the season liam neeson",
            "taken no treason liam neeson",
            "schindler's list the reason liam neeson",
            // --- Setup lines ---
            "reason for the season",
            "treason in the preseason",
        ],
    },

    'amon': {
        all: [
            "bourne identity the cannon matt damon",
            "good will hunting the salmon matt damon",
            "the martian on the gammon matt damon",
            "ocean's eleven the mammon matt damon",
            // --- Setup lines ---
            "cannon on the salmon",
            "mammon of the famine",
        ],
    },

    'ahlberg': {
        all: [
            "marky mark on the iceberg mark wahlberg",
            "the departed from the goldberg mark wahlberg",
            "the fighter on the spielberg mark wahlberg",
            "good vibrations the carlsberg mark wahlberg",
            // --- Setup lines ---
            "iceberg on the spielberg",
            "goldberg on the zuckerberg",
        ],
    },

    // --- Wesley Snipes / Idris Elba / Michael B. Jordan ---
    'ipes': {
        all: [
            "blade daywalker the stripes wesley snipes",
            "new jack city the pipes wesley snipes",
            "passenger 57 the gripes wesley snipes",
            "always bet on black the hypes wesley snipes",
            // --- Setup lines ---
            "pinstripes on the bagpipes",
            "prototypes of the archetypes",
        ],
    },

    'elba': {
        all: [
            "stringer bell the melba idris elba",
            "luther on the case no delta idris elba",
            "mandela on the screen and felt the idris elba",
            "heimdall guardian the shelter idris elba",
            // --- Setup lines ---
            "melba of the delta",
            "shelter in the smelter",
        ],
    },

    'jordan2': {
        all: [
            "creed in the ring the warden michael b. jordan",
            "black panther the gordon michael b. jordan",
            "killmonger on the jordan michael b. jordan",
            "just mercy the guardian michael b. jordan",
            // --- Setup lines ---
            "warden of the gordon",
            "jordan on the accordion",
        ],
    },

    // --- Jamie Foxx / Woody Harrelson ---
    'oxx': {
        all: [
            "any given sunday in the box jamie foxx",
            "django unchained the fox jamie foxx",
            "ray charles reborn orthodox jamie foxx",
            "blame it on the equinox jamie foxx",
            "miami vice the paradox jamie foxx",
            // --- Setup lines ---
            "orthodox in the mailbox",
            "paradox of the equinox fox",
        ],
    },

    'elson2': {
        all: [
            "natural born killer the nelson woody harrelson",
            "zombieland double the felon woody harrelson",
            "true detective the rebellion woody harrelson",
            "white men can't jump the melon woody harrelson",
            // --- Setup lines ---
            "nelson in the rebellion",
            "felon of the melon wellington",
        ],
    },

    // --- Jeff Bridges / Jeff Goldblum / Christopher Walken ---
    'idges': {
        all: [
            "the dude abides the ridges jeff bridges",
            "big lebowski no midges jeff bridges",
            "true grit crossing bridges jeff bridges",
            "crazy heart the fridges jeff bridges",
            // --- Setup lines ---
            "bridges over the ridges",
            "fridges on the ledges",
        ],
    },

    'oldblum': {
        all: [
            "life finds a way the heirloom jeff goldblum",
            "jurassic park the classroom jeff goldblum",
            "the fly in the mushroom jeff goldblum",
            "independence day the ballroom jeff goldblum",
            // --- Setup lines ---
            "heirloom in the ballroom",
            "mushroom in the classroom",
        ],
    },

    'alken': {
        all: [
            "more cowbell awaken christopher walken",
            "king of new york the falcon christopher walken",
            "catch me if you can the talkin christopher walken",
            "deer hunter the stalkin christopher walken",
            // --- Setup lines ---
            "falcon in the balkan",
            "stalkin' and the walkin'",
        ],
    },

    // --- Danny Trejo / Mel Gibson / Russell Crowe ---
    'ejo': {
        all: [
            "machete don't text the dojo danny trejo",
            "from prison to the mojo danny trejo",
            "con air on the pojo danny trejo",
            "desperado from the barrio danny trejo",
            // --- Setup lines ---
            "dojo in the mojo",
            "barrio and the ratio",
        ],
    },

    'ibson': {
        all: [
            "braveheart freedom the gibson mel gibson",
            "lethal weapon the crimson mel gibson",
            "mad max on the prison mel gibson",
            "the passion of the schism mel gibson",
            // --- Setup lines ---
            "crimson of the gibson prison",
            "schism in the organism",
        ],
    },

    'owe': {
        all: [
            "gladiator are you entertained the brow russell crowe",
            "a beautiful mind the flow russell crowe",
            "master and commander the bow russell crowe",
            "cinderella man the throw russell crowe",
            // --- Setup lines ---
            "elbow from the scarecrow",
            "rainbow on the meadow below",
        ],
    },

    // --- Christian Bale / Heath Ledger / Joaquin Phoenix ---
    'ale': {
        all: [
            "american psycho the tale christian bale",
            "dark knight the detail christian bale",
            "the machinist pale christian bale",
            "batman on the trail christian bale",
            // --- Setup lines ---
            "fairy tale on the detail trail",
            "wholesale on the nightingale",
        ],
    },

    'edger': {
        all: [
            "why so serious the ledger heath ledger",
            "joker and the dark knight ledger heath ledger",
            "brokeback mountain the pledger heath ledger",
            "ten things i hate the edger heath ledger",
            // --- Setup lines ---
            "pledger on the ledger",
            "hedger on the wedger",
        ],
    },

    'oenix': {
        all: [
            "joker stairs the onyx joaquin phoenix",
            "gladiator in the tonic joaquin phoenix",
            "walk the line the chronic joaquin phoenix",
            "her voice the iconic joaquin phoenix",
            "napoleon the demonic joaquin phoenix",
            // --- Setup lines ---
            "phoenix from the onyx",
            "chronic of the iconic sonic",
        ],
    },

    // --- Chadwick Boseman / Angela Bassett / Meryl Streep ---
    'oseman': {
        all: [
            "wakanda forever the showman chadwick boseman",
            "black panther the yeoman chadwick boseman",
            "forty-two on the roman chadwick boseman",
            "get on up the bowman chadwick boseman",
            // --- Setup lines ---
            "showman of the bowman roman",
            "yeoman on the snowman",
        ],
    },

    'assett': {
        all: [
            "what is love the asset angela bassett",
            "wakanda queen the facet angela bassett",
            "tina turner biopic the bassett angela bassett",
            "waiting to exhale the gazette angela bassett",
            // --- Setup lines ---
            "asset of the facet",
            "gazette on the cassette",
        ],
    },

    'eep': {
        all: [
            "devil wears prada the steep meryl streep",
            "sophie's choice the deep meryl streep",
            "the iron lady asleep meryl streep",
            "out of africa the sweep meryl streep",
            // --- Setup lines ---
            "deep in the steep sweep",
            "sheep on the jeep leap",
        ],
    },

    // --- Whoopi Goldberg / Tyler Perry / Spike Lee ---
    'oldberg2': {
        all: [
            "sister act the goldberg whoopi goldberg",
            "the view from the iceberg whoopi goldberg",
            "ghost the pottery goldberg whoopi goldberg",
            "color purple the spielberg whoopi goldberg",
            // --- Setup lines ---
            "goldberg on the bloomberg",
            "iceberg in the heidelberg",
        ],
    },

    'erry2': {
        all: [
            "madea don't play the dairy tyler perry",
            "acrimony on the ferry tyler perry",
            "for colored girls the legendary tyler perry",
            "studio mogul the cherry tyler perry",
            // --- Setup lines ---
            "visionary and the legendary",
            "missionary on the ordinary ferry",
        ],
    },

    'ee2': {
        all: [
            "do the right thing the decree spike lee",
            "malcolm x on the marquee spike lee",
            "school daze the guarantee spike lee",
            "he got game the filigree spike lee",
            "blackkklansman the jubilee spike lee",
            // --- Setup lines ---
            "decree on the marquee",
            "filigree of the guarantee",
        ],
    },

    // ========================================================================
    // BATCH 4: ATHLETES — ~80 entries
    // ========================================================================

    // --- Magic Johnson / Larry Bird ---
    'agic': {
        all: [
            "showtime lakers the magic magic johnson",
            "no-look pass the tragic magic johnson",
            "five rings on the pelagic magic johnson",
            "hiv couldn't stop the magic magic johnson",
            // --- Setup lines ---
            "magic in the pelagic",
            "tragic to the cinematic",
        ],
    },

    'ird': {
        all: [
            "three point legend the bird larry bird",
            "boston celtic the word larry bird",
            "trash talk king absurd larry bird",
            "french lick miracle unheard larry bird",
            "clutch shooter undeterred larry bird",
            // --- Setup lines ---
            "hummingbird in the word",
            "absurd like a mockingbird",
        ],
    },

    // --- Kareem Abdul-Jabbar / Allen Iverson ---
    'abbar': {
        all: [
            "skyhook from the star kareem abdul-jabbar",
            "six rings on the handlebar kareem abdul-jabbar",
            "all time scorer the czar kareem abdul-jabbar",
            "airplane roger the avatar kareem abdul-jabbar",
            // --- Setup lines ---
            "superstar on the handlebar",
            "avatar of the cinema czar",
        ],
    },

    'erson': {
        all: [
            "crossover king the person allen iverson",
            "practice what you preach in the version allen iverson",
            "the answer to the question allen iverson",
            "pound for pound the immersion allen iverson",
            "step over like the diversion allen iverson",
            // --- Setup lines ---
            "person in the immersion",
            "version of the diversion",
        ],
    },

    // --- Wilt Chamberlain / Bill Russell ---
    'ain2': {
        all: [
            "hundred points of rain wilt chamberlain",
            "twenty thousand strong the campaign wilt chamberlain",
            "the stilt on the plain wilt chamberlain",
            "dominance unchained the domain wilt chamberlain",
            // --- Setup lines ---
            "campaign on the mountain terrain",
            "domain of the hurricane",
        ],
    },

    'ussell': {
        all: [
            "eleven rings like the muscle bill russell",
            "civil rights the hustle bill russell",
            "celtics dynasty the bustle bill russell",
            "winner's mentality no tussle bill russell",
            // --- Setup lines ---
            "muscle in the hustle tussle",
            "bustle and the rustle",
        ],
    },

    // --- Patrick Ewing / Isiah Thomas ---
    'ewing': {
        all: [
            "the knickerbocker renewing patrick ewing",
            "center of the doing patrick ewing",
            "georgetown to the brewing patrick ewing",
            "ninety knicks reviewing patrick ewing",
            // --- Setup lines ---
            "renewing and reviewing",
            "brewing on the ensuing",
        ],
    },

    'omas': {
        all: [
            "bad boy pistons the drama isiah thomas",
            "detroit grit the panorama isiah thomas",
            "zeke in the arena the llama isiah thomas",
            "jordan rules the trauma isiah thomas",
            // --- Setup lines ---
            "drama of the panorama",
            "comma in the diorama",
        ],
    },

    // --- Charles Barkley / Dennis Rodman / Scottie Pippen ---
    'arkley': {
        all: [
            "round mound of rebound the gnarly charles barkley",
            "i am not a role model charles barkley",
            "turrible on the commentary charles barkley",
            "mvp in the commentary charles barkley",
            "inside the nba the commentary charles barkley",
            // --- Setup lines ---
            "gnarly and the gnarly",
            "commentary on the sedimentary",
        ],
    },

    'odman': {
        all: [
            "rebound king the odd man dennis rodman",
            "bad as i wanna be the mod man dennis rodman",
            "worm on the floor the shotgun rodman",
            "five rings the common rodman",
            "wedding dress the uncommon rodman",
            // --- Setup lines ---
            "odd man on the rodman",
            "common of the uncommon",
        ],
    },

    'ippen': {
        all: [
            "no tippin' on the pippen scottie pippen",
            "six rings dripping scottie pippen",
            "jordan's right hand the kitten scottie pippen",
            "robin to the batman smitten scottie pippen",
            // --- Setup lines ---
            "drippin' and the tippin' pippen",
            "kitten in the mitten",
        ],
    },

    // --- Karl Malone / John Stockton ---
    'alone': {
        all: [
            "the mailman delivers alone karl malone",
            "power forward the throne karl malone",
            "utah jazz the milestone karl malone",
            "post moves to the zone karl malone",
            // --- Setup lines ---
            "alone on the throne milestone",
            "cornerstone of the war zone",
        ],
    },

    'ockton': {
        all: [
            "assist king the stockton john stockton",
            "pick and roll the crouton john stockton",
            "fifteen thousand dimes the cotton john stockton",
            "utah legend the forgotten john stockton",
            // --- Setup lines ---
            "stockton on the cotton",
            "forgotten and the rotten",
        ],
    },

    // --- David Robinson / Tim Duncan ---
    'obinson2': {
        all: [
            "the admiral on the mission david robinson",
            "quadruple double the vision david robinson",
            "seventy-one points the admission david robinson",
            "spurs legend the submission david robinson",
            // --- Setup lines ---
            "mission of the admission",
            "vision in the submission",
        ],
    },

    'uncan': {
        all: [
            "the big fundamental duncan tim duncan",
            "five rings and a function tim duncan",
            "bank shot the conjunction tim duncan",
            "quiet greatness the luncheon tim duncan",
            "greatest power forward the junction tim duncan",
            // --- Setup lines ---
            "function at the junction",
            "luncheon and the conjunction",
        ],
    },

    // --- Tony Parker / Dwyane Wade / Chris Paul ---
    'arker2': {
        all: [
            "french connection the marker tony parker",
            "finals mvp the sparker tony parker",
            "teardrop floater the parker tony parker",
            "spurs guard the embarker tony parker",
            // --- Setup lines ---
            "marker on the parker",
            "sparker of the embarker",
        ],
    },

    'ade2': {
        all: [
            "flash in the wade dwyane wade",
            "d-wade county the tirade dwyane wade",
            "three rings the crusade dwyane wade",
            "miami heat the decade dwyane wade",
            "father prime the cascade dwyane wade",
            // --- Setup lines ---
            "tirade on the crusade",
            "cascade of the decade wade",
        ],
    },

    'aul': {
        all: [
            "point god the haul chris paul",
            "state farm the protocol chris paul",
            "lob city the overhaul chris paul",
            "assist king the free-for-all chris paul",
            // --- Setup lines ---
            "protocol of the free-for-all",
            "overhaul in the banquet hall",
        ],
    },

    // --- Russell Westbrook / James Harden ---
    'brook': {
        all: [
            "why not the textbook russell westbrook",
            "triple double the outlook russell westbrook",
            "mvp the handbook russell westbrook",
            "zero chill the overlook russell westbrook",
            // --- Setup lines ---
            "textbook on the outlook",
            "handbook of the overlook brook",
        ],
    },

    'arden': {
        all: [
            "step back the warden james harden",
            "cooking in the garden james harden",
            "the beard on the pardon james harden",
            "sixty-one points no bargain james harden",
            "mvp in the harden james harden",
            // --- Setup lines ---
            "garden of the warden pardon",
            "harden in the garden",
        ],
    },

    // --- Giannis Antetokounmpo / Kawhi Leonard ---
    'ounmpo': {
        all: [
            "greek freak the pronto giannis antetokounmpo",
            "milwaukee buck the conto giannis",
            "finals mvp the pronto giannis",
            "run and dunk the toronto giannis",
            // --- Setup lines ---
            "pronto in the toronto",
            "conto on the rondo",
        ],
    },

    'eonard': {
        all: [
            "the klaw the standard kawhi leonard",
            "board man gets paid and censored kawhi leonard",
            "fun guy the leopard kawhi leonard",
            "toronto champion the shepherd kawhi leonard",
            // --- Setup lines ---
            "standard of the leopard",
            "shepherd in the censored",
        ],
    },

    // --- Paul George / Damian Lillard ---
    'eorge': {
        all: [
            "playoff p the gorge paul george",
            "no ot tonight the forge paul george",
            "pacers to the clippers the george paul george",
            "that's a bad shot the forge paul george",
            // --- Setup lines ---
            "forge on the gorge",
            "george of the gorgeous",
        ],
    },

    'illard': {
        all: [
            "dame time the wizard damian lillard",
            "logo three the blizzard damian lillard",
            "zero from the pillar damian lillard",
            "oakland kid the thriller damian lillard",
            "wave goodbye the filler damian lillard",
            // --- Setup lines ---
            "blizzard of the wizard",
            "pillar in the thriller",
        ],
    },

    // --- Kyrie Irving / Anthony Davis / Luka Doncic ---
    'rving': {
        all: [
            "uncle drew the swerving kyrie irving",
            "flat earth the unnerving kyrie irving",
            "handle god the deserving kyrie irving",
            "clutch shot the observing kyrie irving",
            // --- Setup lines ---
            "swerving and deserving",
            "observing the unnerving",
        ],
    },

    'avis3': {
        all: [
            "the brow the enclaves anthony davis",
            "bubble champion the davis anthony davis",
            "block party on the mavis anthony davis",
            "fear the brow the archives anthony davis",
            // --- Setup lines ---
            "archives of the davis",
            "enclaves in the conclaves",
        ],
    },

    'oncic': {
        all: [
            "wonder boy the logic luka doncic",
            "step back magic the chronic luka doncic",
            "slovenian prodigy the tonic luka doncic",
            "triple double the sonic luka doncic",
            // --- Setup lines ---
            "chronic of the sonic logic",
            "tonic in the platonic",
        ],
    },

    // --- Tom Brady / Peyton Manning / Joe Montana ---
    'ady': {
        all: [
            "seven rings tom brady",
            "greatest quarterback and it ain't shady tom brady",
            "deflategate can't evade the lady tom brady",
            "super bowl the already tom brady",
            "tb12 method the steady tom brady",
            // --- Setup lines ---
            "already for the steady",
            "lady on the shady",
        ],
    },

    'anning': {
        all: [
            "omaha the planning peyton manning",
            "two rings the commanding peyton manning",
            "sheriff of the banning peyton manning",
            "laser arm the branding peyton manning",
            // --- Setup lines ---
            "planning and the commanding",
            "branding on the expanding",
        ],
    },

    'ontana': {
        all: [
            "the comeback kid the banana joe montana",
            "four rings the cabana joe montana",
            "the drive to the nirvana joe montana",
            "cool joe in the sauna joe montana",
            // --- Setup lines ---
            "banana on the cabana",
            "nirvana in the sauna",
        ],
    },

    // --- Jerry Rice / Barry Sanders / Jim Brown ---
    'ice2': {
        all: [
            "greatest receiver the price jerry rice",
            "touchdown king precise jerry rice",
            "three rings the sacrifice jerry rice",
            "catch everything the device jerry rice",
            // --- Setup lines ---
            "sacrifice and the price",
            "device on the paradise ice",
        ],
    },

    'anders': {
        all: [
            "juke move the commanders barry sanders",
            "highlight reel the bystanders barry sanders",
            "retired on top the slanders barry sanders",
            "detroit legend the candor barry sanders",
            // --- Setup lines ---
            "commanders of the bystanders",
            "slanders of the meanders",
        ],
    },

    'rown3': {
        all: [
            "greatest running back the crown jim brown",
            "lacrosse legend the renown jim brown",
            "cleveland forever the downtown jim brown",
            "activist and the gown jim brown",
            // --- Setup lines ---
            "crown of the downtown renown",
            "showdown on the breakdown",
        ],
    },

    // --- Walter Payton / Emmitt Smith / Randy Moss ---
    'ayton': {
        all: [
            "sweetness in the dayton walter payton",
            "never miss a game the weight on walter payton",
            "man of the year the great one walter payton",
            "chicago bears the straighten walter payton",
            // --- Setup lines ---
            "dayton on the clayton",
            "straighten on the weight on",
        ],
    },

    'ith2': {
        all: [
            "all time rushing the myth emmitt smith",
            "three rings the monolith emmitt smith",
            "dallas cowboy the forthwith emmitt smith",
            "touchdown king the zenith emmitt smith",
            // --- Setup lines ---
            "monolith of the zenith",
            "forthwith and the myth",
        ],
    },

    'oss3': {
        all: [
            "straight cash homie the boss randy moss",
            "you got mossed the sauce randy moss",
            "greatest deep threat the toss randy moss",
            "i play when i want the gloss randy moss",
            // --- Setup lines ---
            "sauce on the lacrosse toss",
            "across from the albatross boss",
        ],
    },

    // --- Calvin Johnson / Deion Sanders / Bo Jackson ---
    'egatron': {
        all: [
            "megatron catching the electron calvin johnson",
            "detroit legend the neutron calvin johnson",
            "record breaking the positron calvin johnson",
            // --- Setup lines ---
            "electron of the neutron",
            "positron on the cyclotron",
        ],
    },

    'eion': {
        all: [
            "prime time the neon deion sanders",
            "two sport legend the aeon deion sanders",
            "must be the money the peon deion sanders",
            "high step the pantheon deion sanders",
            "coach prime the con deion sanders",
            // --- Setup lines ---
            "neon on the pantheon",
            "aeon of the peon",
        ],
    },

    'ojack': {
        all: [
            "bo knows the setback bo jackson",
            "two sport king the comeback bo jackson",
            "tecmo bowl the quarterback bo jackson",
            "hip injury but the flashback bo jackson",
            // --- Setup lines ---
            "setback on the comeback",
            "flashback to the quarterback",
        ],
    },

    // --- Wayne Gretzky / Tiger Woods / Serena Williams ---
    'etzky': {
        all: [
            "the great one no whiskey wayne gretzky",
            "ninety-nine on the jersey wayne gretzky",
            "hockey god the dynasty wayne gretzky",
            "you miss every shot wayne gretzky",
            // --- Setup lines ---
            "risky on the whiskey",
            "frisky in the dynasty",
        ],
    },

    'oods': {
        all: [
            "masters champion the goods tiger woods",
            "sunday red in the neighborhoods tiger woods",
            "fifteen majors the livelihoods tiger woods",
            "comeback king the understood tiger woods",
            // --- Setup lines ---
            "goods in the neighborhoods",
            "livelihoods of the falsehoods",
        ],
    },

    'illiams2': {
        all: [
            "grand slam queen the thrills serena williams",
            "twenty-three titles the mills serena williams",
            "unstoppable the windmills serena williams",
            "greatest athlete the skills serena williams",
            // --- Setup lines ---
            "windmills of the thrills",
            "skills on the hills",
        ],
    },

    // --- Venus Williams / Roger Federer / Rafael Nadal ---
    'enus': {
        all: [
            "seven slams the genus venus williams",
            "pioneer on the venus venus williams",
            "compton to the zenith venus venus williams",
            "sister act the venus venus williams",
            // --- Setup lines ---
            "genus of the venus",
            "zenith of the venus genus",
        ],
    },

    'ederer': {
        all: [
            "twenty slams the editor roger federer",
            "elegant the predator roger federer",
            "sabr the competitor roger federer",
            "greatest grace the exchequer roger federer",
            // --- Setup lines ---
            "predator and the competitor",
            "editor of the creditor",
        ],
    },

    'adal': {
        all: [
            "king of clay the vandal rafael nadal",
            "vamos on the sandal rafael nadal",
            "fourteen french the scandal rafael nadal",
            "never quit the mandal rafael nadal",
            // --- Setup lines ---
            "vandal on the sandal",
            "scandal of the mandal",
        ],
    },

    // --- Novak Djokovic / Pele / Messi / Ronaldo ---
    'ovic': {
        all: [
            "twenty-four slams theovic novak djokovic",
            "nole on the logic novak djokovic",
            "unbreakable the chronic novak djokovic",
            // --- Setup lines ---
            "logic in the chronic",
            "stoic and the heroic",
        ],
    },

    'ele': {
        all: [
            "king of football the gazelle pele",
            "a thousand goals the belle pele",
            "brazilian magic the carousel pele",
            "three world cups the parallel pele",
            // --- Setup lines ---
            "gazelle on the carousel belle",
            "parallel of the personnel",
        ],
    },

    'essi': {
        all: [
            "the goat no question the blessing messi",
            "eight ballon d'or the impressi messi",
            "world cup champion the destiny messi",
            "barcelona magic the legacy messi",
            // --- Setup lines ---
            "messy is the blessing",
            "destiny of the legacy",
        ],
    },

    'aldo': {
        all: [
            "siuuu the bravado ronaldo",
            "five ballon d'or the desperado ronaldo",
            "header king the commando ronaldo",
            "goal machine the avocado ronaldo",
            // --- Setup lines ---
            "bravado of the desperado",
            "commando on the avocado",
        ],
    },

    // --- Neymar / Usain Bolt / Michael Phelps ---
    'eymar': {
        all: [
            "samba skills the grammar neymar",
            "jogo bonito the glamour neymar",
            "rainbow flick the seminar neymar",
            // --- Setup lines ---
            "grammar in the glamour",
            "seminar at the handlebar",
        ],
    },

    'olt': {
        all: [
            "fastest man the jolt usain bolt",
            "world record the revolt usain bolt",
            "lightning bolt the thunderbolt usain bolt",
            "I catapult past every fault usain bolt",
            // --- Setup lines ---
            "thunderbolt on the revolt",
            "catapult from the jolt",
        ],
    },

    'elps': {
        all: [
            "twenty-three golds who helps michael phelps",
            "butterfly through the kelps michael phelps",
            "greatest swimmer and he yelps michael phelps",
            "baltimore bullet in the welps michael phelps",
            // --- Setup lines ---
            "helps in the kelps",
            "yelps and the whelps",
        ],
    },

    // --- Simone Biles / Carl Lewis / Jesse Owens ---
    'iles': {
        all: [
            "greatest gymnast the files simone biles",
            "yurchenko double the miles simone biles",
            "goat in the aisles simone biles",
            "mental health first the trials simone biles",
            // --- Setup lines ---
            "miles and the files",
            "trials in the aisles",
        ],
    },

    'ewis': {
        all: [
            "nine golds the lewis carl lewis",
            "king carl on the premises carl lewis",
            "fastest man the genesis carl lewis",
            "long jump the thesis carl lewis",
            // --- Setup lines ---
            "genesis of the thesis",
            "premises on the nemesis",
        ],
    },

    'owens': {
        all: [
            "four golds in berlin the heavens jesse owens",
            "defied the regime the lesson jesse owens",
            "fastest man the weapons jesse owens",
            "american hero the legend jesse owens",
            // --- Setup lines ---
            "heavens and the lessons",
            "legends of the weapons",
        ],
    },

    // --- Jackie Joyner-Kersee / Florence Griffith-Joyner ---
    'ersee': {
        all: [
            "greatest female athlete the jersey jackie joyner-kersee",
            "heptathlon queen the courtesy jackie joyner-kersee",
            "six olympic medals the mercy jackie joyner-kersee",
            // --- Setup lines ---
            "jersey of the courtesy",
            "mercy on the controversy",
        ],
    },

    'oyner': {
        all: [
            "flo-jo nails the joiner florence griffith-joyner",
            "fastest woman the coiner florence griffith-joyner",
            "world record in the diner florence griffith-joyner",
            "olympic gold the refiner florence griffith-joyner",
            // --- Setup lines ---
            "joiner of the coiner",
            "refiner and the diner",
        ],
    },

    // ========================================================================
    // BATCH 5: MOVIES/TV — ~80 entries
    // ========================================================================

    // --- Pulp Fiction / Kill Bill / Reservoir Dogs ---
    'iction': {
        all: [
            "royale with cheese the conviction pulp fiction",
            "say what again the addiction pulp fiction",
            "ezekiel the jurisdiction pulp fiction",
            "briefcase glow the prediction pulp fiction",
            // --- Setup lines ---
            "conviction in the jurisdiction",
            "addiction and the contradiction",
        ],
    },

    'illbill': {
        all: [
            "five point palm the drill kill bill",
            "wiggle your big toe the thrill kill bill",
            "deadly viper on the hill kill bill",
            "hattori hanzo the skill kill bill",
            // --- Setup lines ---
            "thrill on the windowsill",
            "fulfill the drill until",
        ],
    },

    'ogs': {
        all: [
            "mr. blonde in the logs reservoir dogs",
            "stuck in the middle the cogs reservoir dogs",
            "tip debate in the fogs reservoir dogs",
            // --- Setup lines ---
            "underdogs in the cogs",
            "bulldogs and the watchdogs",
        ],
    },

    // --- Django Unchained / The Departed / Casino ---
    'jango': {
        all: [
            "the d is silent the tango django",
            "unchained from the fandango django",
            "freedom ride the mango django",
            // --- Setup lines ---
            "tango in the fandango",
            "mango on the durango",
        ],
    },

    'eparted': {
        all: [
            "they see the rats but never see the departed",
            "which side you on the charted the departed",
            "boston undercover the uncharted the departed",
            "maybe maybe not the started the departed",
            // --- Setup lines ---
            "departed and the uncharted",
            "started but the brokenhearted",
        ],
    },

    'asino': {
        all: [
            "ace rothstein the casino casino",
            "nicky santoro the volcano casino",
            "high roller the domino casino",
            "house always wins the rhino casino",
            // --- Setup lines ---
            "casino in the volcano",
            "domino on the rhino",
        ],
    },

    // --- Heat / Donnie Brasco / American Gangster ---
    'eat3': {
        all: [
            "don't let yourself get attached the beat heat",
            "bank job the concrete street heat",
            "de niro pacino bringing the heat",
            // --- Setup lines ---
            "heartbeat on the street",
            "backseat to the elite",
        ],
    },

    'asco': {
        all: [
            "forget about it the fiasco donnie brasco",
            "undercover the tabasco donnie brasco",
            "lefty two guns the fiasco donnie brasco",
            // --- Setup lines ---
            "fiasco in the tabasco",
            "fiasco of the monaco",
        ],
    },

    'angster': {
        all: [
            "bumpy johnson the gangster american gangster",
            "heroin king the prankster american gangster",
            "frank lucas the bankster american gangster",
            "harlem empire the hamster american gangster",
            // --- Setup lines ---
            "gangster and the prankster",
            "bankster on the dumpster",
        ],
    },

    // --- A Bronx Tale / King of New York / Carlito's Way ---
    'onxtale': {
        all: [
            "the saddest thing in life the exhale a bronx tale",
            "c chose the door the detail a bronx tale",
            "nobody cares the betrayal a bronx tale",
            "now youse can't leave the trail a bronx tale",
            // --- Setup lines ---
            "exhale on the detail trail",
            "betrayal on the holy grail",
        ],
    },

    'ingofny': {
        all: [
            "new jack hustle the king king of new york",
            "frank white on the wing king of new york",
            "walken rules the ring king of new york",
            // --- Setup lines ---
            "king of the ring on the wing",
            "swing from the king bling",
        ],
    },

    'arlito': {
        all: [
            "the dream don't die the dorito carlito's way",
            "every time i try to get out the burrito carlito's way",
            "benny blanco from the mosquito carlito's way",
            // --- Setup lines ---
            "burrito on the dorito",
            "mosquito in the incognito",
        ],
    },

    // --- The Usual Suspects / Memento / Interstellar ---
    'uspects': {
        all: [
            "keyser soze the defects usual suspects",
            "greatest trick the devil the rejects usual suspects",
            "verbal kint the intellects usual suspects",
            // --- Setup lines ---
            "suspects and the defects",
            "intellects of the architects",
        ],
    },

    'emento': {
        all: [
            "remember sammy jankis the momento memento",
            "tattoo the truth the lamento memento",
            "backwards the sacramento memento",
            // --- Setup lines ---
            "momento in the lamento",
            "sacramento on the portamento",
        ],
    },

    'ellar': {
        all: [
            "murph don't let me leave the stellar interstellar",
            "love transcends the cellar interstellar",
            "time dilation the propeller interstellar",
            "black hole the bestseller interstellar",
            // --- Setup lines ---
            "stellar in the bestseller",
            "propeller of the storyteller",
        ],
    },

    // --- Tenet / Oppenheimer / Blade Runner ---
    'enet': {
        all: [
            "time inversion the magnet tenet",
            "protagonist the planet tenet",
            "sator square the cabinet tenet",
            // --- Setup lines ---
            "cabinet of the planet",
            "magnet on the granite",
        ],
    },

    'enheimer': {
        all: [
            "i am become death the timer oppenheimer",
            "manhattan project the climber oppenheimer",
            "now i am death the rhymer oppenheimer",
            "trinity test the primer oppenheimer",
            // --- Setup lines ---
            "timer on the climber",
            "primer for the old-timer",
        ],
    },

    'unner': {
        all: [
            "tears in rain the runner blade runner",
            "replicant the stunner blade runner",
            "do you dream the gunner blade runner",
            "time to die the frontrunner blade runner",
            // --- Setup lines ---
            "runner and the stunner",
            "frontrunner to the gunner",
        ],
    },

    // --- Alien / Predator / Die Hard ---
    'lien': {
        all: [
            "in space no one hears - the alien",
            "ripley the resilient alien",
            "game over man the civilian alien",
            "face hugger the chameleon alien",
            // --- Setup lines ---
            "alien and the civilian",
            "chameleon of the reptilian",
        ],
    },

    'edator': {
        all: [
            "get to the chopper the predator predator",
            "if it bleeds we can kill it the editor predator",
            "you're one ugly the competitor predator",
            "jungle warfare the senator predator",
            // --- Setup lines ---
            "predator or the competitor",
            "editor of the senator",
        ],
    },

    'iehard': {
        all: [
            "yippee ki yay the diehard die hard",
            "nakatomi plaza the graveyard die hard",
            "john mcclane the bodyguard die hard",
            "christmas movie the diehard die hard",
            // --- Setup lines ---
            "diehard in the graveyard",
            "bodyguard on the boulevard",
        ],
    },

    // --- Lethal Weapon / Beverly Hills Cop / Coming to America ---
    'eapon': {
        all: [
            "riggs and murtaugh the weapon lethal weapon",
            "too old for this the deacon lethal weapon",
            "loose cannon the beacon lethal weapon",
            // --- Setup lines ---
            "weapon of the deacon",
            "beacon on the weaken",
        ],
    },

    'llscop': {
        all: [
            "axel foley on the rooftop beverly hills cop",
            "banana in the tailpipe nonstop beverly hills cop",
            "detroit hustle at the bus stop beverly hills cop",
            // --- Setup lines ---
            "nonstop at the rooftop",
            "bus stop to the pit stop",
        ],
    },

    'merica': {
        all: [
            "zamunda prince in america coming to america",
            "sexual chocolate the replica coming to america",
            "my name is peaches coming to america",
            "soul glo the majestical coming to america",
            // --- Setup lines ---
            "america in the replica",
            "majestical and the metaphorical",
        ],
    },

    // --- Bad Boys / Friday / Boyz N the Hood ---
    'adboys': {
        all: [
            "whatcha gonna do the bad boys bad boys",
            "ride together die together bad boys",
            "mike lowrey the decoy bad boys",
            "this is miami killjoy bad boys",
            // --- Setup lines ---
            "bad boys with the decoy",
            "killjoy to the alloy",
        ],
    },

    'riday': {
        all: [
            "you got knocked out midday friday",
            "bye felicia the mayday friday",
            "big worm the payday friday",
            "ain't got no job the relay friday",
            "craig and smokey the heyday friday",
            // --- Setup lines ---
            "payday on the relay midday",
            "mayday to the heyday",
        ],
    },

    'hood': {
        all: [
            "I built my increase from nothing to hood",
            "either they don't know the falsehood boyz n the hood",
            "south central the neighborhood boyz n the hood",
            "doughboy the brotherhood boyz n the hood",
            // --- Setup lines ---
            "neighborhood of the brotherhood",
            "falsehood in the livelihood hood",
        ],
    },

    // --- Menace II Society / Set It Off / Paid in Full ---
    'enace': {
        all: [
            "o-dog on the furnace menace ii society",
            "kane's choice the menace menace ii society",
            "dead presidents the surface menace ii society",
            // --- Setup lines ---
            "furnace on the surface menace",
            "grimace and the pinnace",
        ],
    },

    'etitoff': {
        all: [
            "four queens the playoff set it off",
            "bank heist the standoff set it off",
            "jada and the cast the tradeoff set it off",
            // --- Setup lines ---
            "standoff for the playoff",
            "tradeoff and the payoff",
        ],
    },

    'nfull': {
        all: [
            "azie mitch and rich the handful paid in full",
            "harlem hustle the bountiful paid in full",
            "dead presidents the truthful paid in full",
            "alpo rico and azie the powerful paid in full",
            // --- Setup lines ---
            "handful of the bountiful",
            "powerful and the plentiful",
        ],
    },

    // --- Belly / New Jack City / Juice ---
    'elly3': {
        all: [
            "tommy buns the smelly belly",
            "sincere the jelly belly",
            "jamaican queens the deli belly",
            // --- Setup lines ---
            "jelly in the deli belly",
            "smelly and the vermicelli",
        ],
    },

    'ewjack': {
        all: [
            "nino brown the setback new jack city",
            "am i my brother's keeper the comeback new jack city",
            "crack era the flashback new jack city",
            "sit your five dollar self down the knickknack new jack city",
            // --- Setup lines ---
            "setback in the comeback",
            "flashback to the knickknack",
        ],
    },

    'uice': {
        all: [
            "you got the juice now the truce juice",
            "bishop on the loose juice",
            "tupac with the deuce juice",
            "power respect the produce juice",
            // --- Setup lines ---
            "truce on the loose",
            "produce of the spruce",
        ],
    },

    // --- Above the Rim / He Got Game / White Men Can't Jump ---
    'rim': {
        all: [
            "birdie and the brim above the rim",
            "tupac from the gym above the rim",
            "playground legend the interim above the rim",
            // --- Setup lines ---
            "interim on the brim",
            "gymnasium from the whim",
        ],
    },

    'gotgame': {
        all: [
            "jesus shuttlesworth the acclaim he got game",
            "spike and denzel the flame he got game",
            "hoop dreams the became he got game",
            // --- Setup lines ---
            "acclaim and the became flame",
            "overcame the hall of fame",
        ],
    },

    'antjump': {
        all: [
            "you can't listen the pump white men can't jump",
            "hustle on the court the jump white men can't jump",
            "woody and wesley the bump white men can't jump",
            // --- Setup lines ---
            "pump up the jump",
            "bump from the stump",
        ],
    },

    // --- Love & Basketball / House Party / Do the Right Thing ---
    'asketball': {
        all: [
            "double or nothing in the hall love and basketball",
            "first quarter to the fourth the basketball love and basketball",
            "monica and quincy the protocol love and basketball",
            // --- Setup lines ---
            "basketball in the protocol",
            "hall and the free-for-all",
        ],
    },

    'ouseparty': {
        all: [
            "kid n play the party house party",
            "dance off in the smarty house party",
            "pajama jam the hearty house party",
            // --- Setup lines ---
            "party in the smarty",
            "hearty at the party",
        ],
    },

    'ightthing': {
        all: [
            "love or hate the right thing do the right thing",
            "radio raheem the everything do the right thing",
            "I mastered fight and conquered every thing",
            "mookie threw the anything do the right thing",
            // --- Setup lines ---
            "everything and the lightning",
            "right thing is the tight thing",
        ],
    },

    // --- Creed / Wakanda Forever / Deadpool ---
    'eed2': {
        all: [
            "adonis in the ring the creed creed",
            "rocky legacy the freed creed",
            "drago's son at speed creed",
            "dame trained on the guaranteed creed",
            // --- Setup lines ---
            "proceed to the stampede",
            "guaranteed at the decreed speed",
        ],
    },

    'orever': {
        all: [
            "wakanda forever the endeavor wakanda forever",
            "shuri queen the clever wakanda forever",
            "vibranium whatever wakanda forever",
            "t'challa legacy the forever wakanda forever",
            // --- Setup lines ---
            "endeavor in the whatever forever",
            "whatever the endeavor together",
        ],
    },

    'eadpool': {
        all: [
            "maximum effort the carpool deadpool",
            "fourth wall break the gene pool deadpool",
            "chimichangas the whirlpool deadpool",
            "baby hand the cesspool deadpool",
            "merc with a mouth the tool deadpool",
            // --- Setup lines ---
            "carpool to the whirlpool",
            "gene pool in the cesspool",
        ],
    },

    // --- Venom / Ant-Man / Captain America ---
    'enom': {
        all: [
            "we are venom the phenom venom",
            "symbiote the antivenom venom",
            "lethal protector the denim venom",
            // --- Setup lines ---
            "phenom in the venom",
            "denim on the antivenom",
        ],
    },

    'ntman': {
        all: [
            "size don't matter the ant man ant-man",
            "quantum realm the plan man ant-man",
            "pym particles the scan man ant-man",
            // --- Setup lines ---
            "plan man of the clan",
            "scan man on the catamaran",
        ],
    },

    'merica2': {
        all: [
            "i can do this all day the empirica captain america",
            "on your left the mystical captain america",
            "avengers assemble the allegorical captain america",
            "vibranium shield the america captain america",
            // --- Setup lines ---
            "allegorical in the rhetorical",
            "empirica of the america",
        ],
    },

    // ========================================================================
    // BATCH 6: TV HOSTS / GAME SHOWS — ~40 entries
    // ========================================================================

    'arey': {
        all: [
            "come on down and don't vary drew carey",
            "price is right the prairie drew carey",
            "whose line is it the scary drew carey",
            "cleveland rocks the hairy drew carey",
            // --- Setup lines ---
            "prairie and the hairy",
            "scary on the ordinary",
        ],
    },

    'rady': {
        all: [
            "let's make a deal already wayne brady",
            "is wayne brady gonna have to get shady wayne brady",
            "whose line comedic and it ain't lazy wayne brady",
            // --- Setup lines ---
            "already and the steady brady",
            "shady on the promenade",
        ],
    },

    'orthy': {
        all: [
            "are you smarter than a fifth grader worthy jeff foxworthy",
            "you might be a redneck the noteworthy jeff foxworthy",
            "blue collar comedy the trustworthy jeff foxworthy",
            // --- Setup lines ---
            "noteworthy and the trustworthy",
            "praiseworthy in the worthy",
        ],
    },

    'anks2': {
        all: [
            "smize through the ranks tyra banks",
            "america's next top the flanks tyra banks",
            "fierce walk the planks tyra banks",
            "modelland the tanks tyra banks",
            // --- Setup lines ---
            "ranks on the riverbanks",
            "planks and the outflanks",
        ],
    },

    'amsay': {
        all: [
            "it's raw no delay gordon ramsay",
            "hell's kitchen the melee gordon ramsay",
            "idiot sandwich the relay gordon ramsay",
            "where's the lamb sauce the bouquet gordon ramsay",
            "donkey on the pathway gordon ramsay",
            // --- Setup lines ---
            "melee on the relay",
            "pathway to the gateway",
        ],
    },

    'rylls': {
        all: [
            "improvise adapt the skills bear grylls",
            "drink your own the thrills bear grylls",
            "man vs wild the chills bear grylls",
            // --- Setup lines ---
            "skills and the thrills",
            "chills on the foothills",
        ],
    },

    'ourdain': {
        all: [
            "parts unknown the domain anthony bourdain",
            "no reservations the campaign anthony bourdain",
            "street food the terrain anthony bourdain",
            "travel the world the membrane anthony bourdain",
            // --- Setup lines ---
            "domain of the terrain campaign",
            "membrane on the windowpane",
        ],
    },

    'ieri': {
        all: [
            "flavor town the theory guy fieri",
            "triple d the dreary guy fieri",
            "winner winner the leery guy fieri",
            "donkey sauce the cheery guy fieri",
            // --- Setup lines ---
            "theory of the cheery",
            "leery and the deary",
        ],
    },

    'ewart': {
        all: [
            "it's a good thing the stewart martha stewart",
            "crafts and the cohort martha stewart",
            "homemade the effort martha stewart",
            // --- Setup lines ---
            "stewart in the effort",
            "cohort of the escort",
        ],
    },

    'annon': {
        all: [
            "wild n out the cannon nick cannon",
            "drumline the abandon nick cannon",
            "masked singer the phantom nick cannon",
            // --- Setup lines ---
            "cannon in the abandon",
            "phantom of the canon",
        ],
    },

    'rews': {
        all: [
            "terry loves yogurt the news terry crews",
            "agt golden buzzer the reviews terry crews",
            "brooklyn nine nine the crews terry crews",
            "muscle flex the overviews terry crews",
            // --- Setup lines ---
            "reviews and the interviews",
            "crews in the curfews",
        ],
    },

    'lum': {
        all: [
            "project runway the plum heidi klum",
            "supermodel the album heidi klum",
            "making the cut the drum heidi klum",
            // --- Setup lines ---
            "plum in the curriculum",
            "album of the platinum",
        ],
    },

    'tern': {
        all: [
            "king of all media the concern howard stern",
            "got talent the discern howard stern",
            "private parts the return howard stern",
            "america's judge the stern howard stern",
            // --- Setup lines ---
            "concern of the discern",
            "return to the pattern",
        ],
    },

    'opez': {
        all: [
            "why you crying the lopez george lopez",
            "george lopez show no mope-ez george lopez",
            "stand up comedy the tropes george lopez",
            // --- Setup lines ---
            "no-mope on the tightrope",
            "lopez with the kaleidoscope",
        ],
    },

    'lesias': {
        all: [
            "fluffy and the amnesia gabriel iglesias",
            "six levels the fantasia gabriel iglesias",
            "chocolate cake the nostalgia gabriel iglesias",
            "i'm not fat i'm fluffy the magnesia gabriel iglesias",
            // --- Setup lines ---
            "amnesia of the fantasia",
            "nostalgia in the magnesia",
        ],
    },

    'edric': {
        all: [
            "kings of comedy the metric cedric the entertainer",
            "original kings the electric cedric the entertainer",
            "barbershop the eccentric cedric the entertainer",
            // --- Setup lines ---
            "metric and the electric",
            "eccentric and the concentric",
        ],
    },

    'attwilliams': {
        all: [
            "pimp chronicles the thrills katt williams",
            "internet gangster the skills katt williams",
            "don't worry be happy the mills katt williams",
            "perm tight the windmills katt williams",
            // --- Setup lines ---
            "thrills and the skills",
            "windmills on the foothills",
        ],
    },

    'erniemac': {
        all: [
            "i ain't scared the setback bernie mac",
            "kings of comedy no lack bernie mac",
            "who you with the knickknack bernie mac",
            "milk and cookies on the track bernie mac",
            // --- Setup lines ---
            "setback on the racetrack",
            "knickknack on the quarterback",
        ],
    },

    'ryor': {
        all: [
            "raw genius the prior richard pryor",
            "live on sunset the fire richard pryor",
            "mudbone the supplier richard pryor",
            "wino and junkie the higher richard pryor",
            // --- Setup lines ---
            "prior to the supplier fire",
            "higher on the live wire",
        ],
    },

    'oxx2': {
        all: [
            "you big dummy the paradox redd foxx",
            "sanford and son the orthodox redd foxx",
            "elizabeth i'm coming the mailbox redd foxx",
            "junkyard king the detox redd foxx",
            // --- Setup lines ---
            "paradox of the orthodox",
            "mailbox on the detox",
        ],
    },

    'ilson2': {
        all: [
            "here come da judge the precision flip wilson",
            "geraldine the decision flip wilson",
            "the devil made me do it the vision flip wilson",
            // --- Setup lines ---
            "precision of the decision",
            "vision in the television",
        ],
    },

    // --- Wendy Williams ---
    'endy': {
        all: [
            "how you doin' the trendy wendy williams",
            "hot topics the friendly wendy williams",
            "purple chair the effendi wendy williams",
            // --- Setup lines ---
            "trendy and the friendly",
            "effendi on the mend",
        ],
    },

    // ========================================================================
    // BATCH 7: HISTORICAL / CULTURAL — ~60 entries
    // ========================================================================

    // --- Greek Philosophers ---
    'otle': {
        all: [
            "golden mean the bottle aristotle",
            "first principles the throttle aristotle",
            "logic and reason the full throttle aristotle",
            "politics from the model aristotle",
            // --- Setup lines ---
            "throttle on the bottle",
            "model of the full throttle",
        ],
    },

    'ato': {
        all: [
            "republic of the state-o plato",
            "cave allegory the dato plato",
            "philosopher king the tomato plato",
            // --- Setup lines ---
            "tomato on the potato",
            "vibrato of the legato",
        ],
    },

    'ates': {
        all: [
            "know thyself the debates socrates",
            "examined life the mandates socrates",
            "hemlock cup the updates socrates",
            "questions everything the playmates socrates",
            // --- Setup lines ---
            "debates and the mandates",
            "updates on the classmates",
        ],
    },

    // --- Confucius / Sun Tzu ---
    'ucius': {
        all: [
            "wise words no ruckus confucius",
            "golden rule the focus confucius",
            "man who chase two rabbits the mucus confucius",
            "journey of a thousand miles confucius",
            // --- Setup lines ---
            "focus and the locus",
            "ruckus in the mucus",
        ],
    },

    'untzu': {
        all: [
            "art of war the voodoo sun tzu",
            "supreme art is to subdue sun tzu",
            "appear weak when strong kung fu sun tzu",
            "every battle is won before the breakthrough sun tzu",
            // --- Setup lines ---
            "kung fu of the voodoo",
            "breakthrough from the bamboo",
        ],
    },

    // --- Alexander the Great / Julius Caesar / Cleopatra ---
    'ander': {
        all: [
            "conquered the world the commander alexander",
            "no more worlds the bystander alexander",
            "macedon to the lander alexander the great",
            "never defeated the slander alexander",
            // --- Setup lines ---
            "commander and the bystander",
            "slander of the salamander",
        ],
    },

    'aesar': {
        all: [
            "et tu brute the freezer julius caesar",
            "veni vidi vici the teaser julius caesar",
            "crossed the rubicon the pleaser julius caesar",
            "ides of march the geezer julius caesar",
            // --- Setup lines ---
            "freezer and the teaser",
            "pleaser on the geezer",
        ],
    },

    'atra2': {
        all: [
            "queen of the nile the mantra cleopatra",
            "asp at the breast the tantra cleopatra",
            "beauty and brains the plethora cleopatra",
            "ruled two empires the et cetera cleopatra",
            // --- Setup lines ---
            "mantra in the tantra",
            "plethora of the et cetera",
        ],
    },

    // --- Napoleon / Queen Elizabeth / Henry VIII ---
    'oleon': {
        all: [
            "conquered europe the neon napoleon",
            "waterloo the chameleon napoleon",
            "short king the pantheon napoleon",
            "exile island the peon napoleon",
            // --- Setup lines ---
            "neon of the chameleon",
            "pantheon of the napoleon",
        ],
    },

    'izabeth': {
        all: [
            "god save the queen beneath queen elizabeth",
            "long may she reign the commonwealth queen elizabeth",
            "crown jewels the stealth queen elizabeth",
            "seventy years the health queen elizabeth",
            // --- Setup lines ---
            "beneath the commonwealth",
            "stealth of the health",
        ],
    },

    'enry': {
        all: [
            "six wives the entry henry viii",
            "break from rome the sentry henry viii",
            "head rolls the inventory henry viii",
            "church of england the gentry henry viii",
            // --- Setup lines ---
            "entry of the sentry",
            "gentry in the inventory",
        ],
    },

    // --- King Arthur / Robin Hood / William Wallace ---
    'rthur': {
        all: [
            "excalibur the author king arthur",
            "round table the laughter king arthur",
            "camelot the hereafter king arthur",
            "holy grail the chapter king arthur",
            // --- Setup lines ---
            "author in the laughter",
            "chapter of the hereafter",
        ],
    },

    'obinhood': {
        all: [
            "steal from the rich the falsehood robin hood",
            "sherwood forest the brotherhood robin hood",
            "arrow true the neighborhood robin hood",
            // --- Setup lines ---
            "brotherhood in the neighborhood",
            "falsehood of the livelihood",
        ],
    },

    'allace': {
        all: [
            "freedom in the palace william wallace",
            "braveheart no malice william wallace",
            "scotland forever the chalice william wallace",
            "they may take our lives the callous william wallace",
            // --- Setup lines ---
            "palace of the chalice",
            "malice in the alice",
        ],
    },

    // --- Genghis Khan / Marco Polo ---
    'khan': {
        all: [
            "conquered the world the plan genghis khan",
            "mongol empire the clan genghis khan",
            "horseback the caravan genghis khan",
            "largest empire the span genghis khan",
            // --- Setup lines ---
            "caravan of the clan khan",
            "plan of the catamaran",
        ],
    },

    'olo': {
        all: [
            "traveled the world the solo marco polo",
            "silk road the polo marco polo",
            "east meets west the yolo marco polo",
            // --- Setup lines ---
            "solo on the polo",
            "yolo in the photo",
        ],
    },

    // --- George Washington / Benjamin Franklin / Thomas Jefferson ---
    'ashington': {
        all: [
            "first president the mission george washington",
            "crossed the delaware the vision george washington",
            "cannot tell a lie the condition george washington",
            "founding father the tradition george washington",
            // --- Setup lines ---
            "mission of the vision",
            "tradition in the condition",
        ],
    },

    'anklin': {
        all: [
            "key and the kite benjamin franklin",
            "hundred dollar bill the ranklin benjamin franklin",
            "early to bed the blanklin benjamin franklin",
            "founding father the franklin benjamin franklin",
            // --- Setup lines ---
            "franklin on the franklin",
            "blanket in the thankful",
        ],
    },

    'efferson': {
        all: [
            "declaration the comparison thomas jefferson",
            "all men are created the garrison thomas jefferson",
            "monticello the harrison thomas jefferson",
            // --- Setup lines ---
            "comparison of the garrison",
            "harrison in the clarion",
        ],
    },

    // --- Theodore Roosevelt / FDR / Winston Churchill ---
    'oosevelt': {
        all: [
            "speak softly the roosevelt theodore roosevelt",
            "big stick the melt theodore roosevelt",
            "rough riders the felt theodore roosevelt",
            "teddy bear the heartfelt roosevelt",
            // --- Setup lines ---
            "heartfelt on the belt",
            "roosevelt and the melt",
        ],
    },

    'dr': {
        all: [
            "nothing to fear but the fear fdr",
            "new deal the pioneer fdr",
            "four terms the cavalier fdr",
            "fireside chat the volunteer fdr",
            // --- Setup lines ---
            "pioneer and the cavalier",
            "volunteer in the frontier",
        ],
    },

    'urchill': {
        all: [
            "never surrender the goodwill winston churchill",
            "blood sweat tears the windmill winston churchill",
            "finest hour the refill winston churchill",
            "we shall fight the fulfill winston churchill",
            // --- Setup lines ---
            "goodwill on the windmill",
            "refill and the fulfill",
        ],
    },

    // --- Che Guevara / Harriet Tubman / Frederick Douglass ---
    'evara': {
        all: [
            "revolutionary the mascara che guevara",
            "viva la revolucion the tiara che guevara",
            "motorcycle diaries the sahara che guevara",
            // --- Setup lines ---
            "mascara in the sahara",
            "tiara on the riviera",
        ],
    },

    'ubman': {
        all: [
            "underground railroad the frontman harriet tubman",
            "never lost a passenger the gunman harriet tubman",
            "moses of her people the clubman harriet tubman",
            "freedom fighter the stuntman harriet tubman",
            // --- Setup lines ---
            "frontman of the gunman",
            "clubman and the stuntman",
        ],
    },

    'ouglass': {
        all: [
            "narrative of the colossus frederick douglass",
            "abolitionist the flawless frederick douglass",
            "if there is no struggle the cautious frederick douglass",
            "power concedes nothing the lawless frederick douglass",
            // --- Setup lines ---
            "colossus of the flawless",
            "cautious and the lawless",
        ],
    },

    // --- Rosa Parks / Marcus Garvey / W.E.B. Du Bois ---
    'arks2': {
        all: [
            "no i won't stand the sparks rosa parks",
            "bus seat that changed the marks rosa parks",
            "montgomery the hallmarks rosa parks",
            "civil rights the landmarks rosa parks",
            // --- Setup lines ---
            "sparks on the landmarks",
            "hallmarks of the benchmarks",
        ],
    },

    'arvey': {
        all: [
            "back to africa the harvey marcus garvey",
            "unia the army marcus garvey",
            "black star line the starvy marcus garvey",
            // --- Setup lines ---
            "harvey and the army",
            "barmy on the swami",
        ],
    },

    'ubois': {
        all: [
            "talented tenth the turquoise w.e.b. du bois",
            "souls of black folk the poise w.e.b. du bois",
            "double consciousness the noise w.e.b. du bois",
            "naacp founder the joys w.e.b. du bois",
            // --- Setup lines ---
            "turquoise of the poise",
            "noise in the decoys",
        ],
    },

    // --- Langston Hughes / Maya Angelou / Toni Morrison ---
    'ughes': {
        all: [
            "dream deferred the blues langston hughes",
            "harlem renaissance the news langston hughes",
            "i too sing america the views langston hughes",
            "rivers run deep the clues langston hughes",
            // --- Setup lines ---
            "blues and the news",
            "views and the clues",
        ],
    },

    'elou': {
        all: [
            "i know why the caged bird the voodoo maya angelou",
            "still i rise the taboo maya angelou",
            "phenomenal woman the guru maya angelou",
            "on the pulse of morning the through maya angelou",
            // --- Setup lines ---
            "voodoo of the taboo",
            "guru in the kung fu",
        ],
    },

    'orrison': {
        all: [
            "beloved the comparison toni morrison",
            "song of solomon the garrison toni morrison",
            "if there's a book you want to read the morrison toni morrison",
            "nobel laureate the clarion toni morrison",
            // --- Setup lines ---
            "comparison in the garrison",
            "clarion of the morrison",
        ],
    },

    // --- James Baldwin / Zora Neale Hurston ---
    'aldwin': {
        all: [
            "fire next time the win james baldwin",
            "go tell it on the mountain the twin james baldwin",
            "not everything faced the has-been james baldwin",
            "another country the bulletin james baldwin",
            // --- Setup lines ---
            "win in the bulletin twin",
            "has-been and the begin",
        ],
    },

    'urston': {
        all: [
            "their eyes were watching the austin zora neale hurston",
            "sweat the effort the boston zora neale hurston",
            "harlem renaissance the houston zora neale hurston",
            // --- Setup lines ---
            "austin of the houston",
            "boston on the crouton",
        ],
    },

    // --- Nikola Tesla / Thomas Edison ---
    'esla': {
        all: [
            "alternating current the tesla nikola tesla",
            "genius ahead the fiesta nikola tesla",
            "wireless power the siesta nikola tesla",
            "wardenclyffe the amnesia nikola tesla",
            // --- Setup lines ---
            "tesla in the fiesta",
            "siesta of the amnesia",
        ],
    },

    'dison': {
        all: [
            "light bulb the prison thomas edison",
            "ninety-nine perspiration the vision thomas edison",
            "phonograph the precision thomas edison",
            "genius is one percent the revision thomas edison",
            // --- Setup lines ---
            "prison of the precision",
            "vision and the revision",
        ],
    },

    // --- Marie Curie / Isaac Newton / Galileo ---
    'urie': {
        all: [
            "radioactive the fury marie curie",
            "two nobels the jury marie curie",
            "radium glow the potpourri marie curie",
            "pioneered the mercury marie curie",
            // --- Setup lines ---
            "fury of the jury",
            "potpourri in the mercury",
        ],
    },

    'ewton': {
        all: [
            "gravity falling the crouton isaac newton",
            "apple dropped the futon isaac newton",
            "laws of motion the baton isaac newton",
            "standing on shoulders the mutton isaac newton",
            // --- Setup lines ---
            "crouton on the futon",
            "baton of the carton",
        ],
    },

    'alileo': {
        all: [
            "still it moves the cameo galileo",
            "telescope the romeo galileo",
            "earth moves the stereo galileo",
            "heresy the video galileo",
            // --- Setup lines ---
            "cameo of the romeo",
            "stereo in the video",
        ],
    },

    // --- Da Vinci / Michelangelo / Picasso ---
    'inci': {
        all: [
            "mona lisa smile the da vinci da vinci",
            "vitruvian man the quincy da vinci",
            "renaissance genius the princy da vinci",
            "inventor ahead the epiphany da vinci",
            // --- Setup lines ---
            "da vinci in the quincy",
            "princy of the prophecy",
        ],
    },

    'angelo': {
        all: [
            "sistine chapel the jello michelangelo",
            "david carved the fellow michelangelo",
            "pieta the cello michelangelo",
            "renaissance the othello michelangelo",
            // --- Setup lines ---
            "jello on the cello",
            "fellow of the othello",
        ],
    },

    'asso': {
        all: [
            "cubism the lasso picasso",
            "guernica the bravado picasso",
            "blue period the el paso picasso",
            "every child the desperado picasso",
            "abstract genius the fiasco picasso",
            // --- Setup lines ---
            "lasso in the el paso",
            "bravado of the desperado",
        ],
    },

    // --- Shakespeare / Beethoven / Mozart / Bach ---
    'eare': {
        all: [
            "to be or not the nightmare shakespeare",
            "all the world's a stage the millionaire shakespeare",
            "romeo and juliet the debonaire shakespeare",
            "hamlet's ghost the solitaire shakespeare",
            "much ado about the thoroughfare shakespeare",
            // --- Setup lines ---
            "nightmare in the millionaire",
            "debonaire and the solitaire",
        ],
    },

    'oven': {
        all: [
            "fifth symphony the woven beethoven",
            "moonlight sonata the cloven beethoven",
            "fur elise the proven beethoven",
            "deaf but still composing the oven beethoven",
            "ode to joy the interwoven beethoven",
            // --- Setup lines ---
            "woven and the proven",
            "cloven in the oven",
        ],
    },

    'ozart': {
        all: [
            "requiem like mozart composing from the dark",
            "symphony number forty the pop art mozart",
            "prodigy at five the go-kart mozart",
            "eine kleine the sweetheart mozart",
            // --- Setup lines ---
            "pop art of the go-kart",
            "sweetheart on the mozart",
        ],
    },

    'ach': {
        all: [
            "well tempered the stache bach",
            "fugue master the detach bach",
            "cello suites the attach bach",
            "toccata the dispatch bach",
            // --- Setup lines ---
            "detach and the dispatch",
            "attach from the batch",
        ],
    },

    // --- Albert Einstein (more) ---
    'einstein2': {
        all: [
            "e equals mc the stein einstein",
            "theory of relativity the baseline einstein",
            "insanity is doing the same the pipeline einstein",
            "imagination is more the grapevine einstein",
            "god does not play dice the sunshine einstein",
            // --- Setup lines ---
            "baseline of the pipeline",
            "grapevine on the sunshine",
        ],
    },

    // --- Attila the Hun / Vlad the Impaler ---
    'ttila': {
        all: [
            "scourge of god the villa attila",
            "conquered the empire the gorilla attila",
            "horseback terror the guerilla attila",
            // --- Setup lines ---
            "villa of the gorilla",
            "guerilla on the vanilla",
        ],
    },

    'mpaler': {
        all: [
            "prince of darkness the jailer vlad the impaler",
            "stakes through the trailer vlad the impaler",
            "dracula origins the retailer vlad the impaler",
            // --- Setup lines ---
            "jailer and the retailer",
            "trailer to the wholesaler",
        ],
    },

    // --- Booker T. Washington ---
    'ooker': {
        all: [
            "cast down your bucket the looker booker t. washington",
            "up from slavery the hooker booker t. washington",
            "tuskegee the snooker booker t. washington",
            // --- Setup lines ---
            "looker and the hooker",
            "snooker on the onlooker",
        ],
    },

    // --- Richard Wright ---
    'right': {
        all: [
            "native son the spotlight richard wright",
            "black boy in the moonlight richard wright",
            "bigger thomas the dynamite richard wright",
            // --- Setup lines ---
            "spotlight on the dynamite",
            "moonlight in the oversight",
        ],
    },

};

// ============================================================================
// PUNCHLINE TEMPLATES — category-based dynamic generation
// These templates work with ANY celebrity name from the matching category
// ============================================================================

const PUNCHLINE_TEMPLATES = {
    rapper: [
        "spit it like {name}",
        "flow so cold they call me {name}",
        "run the game just like {name}",
        "bars on bars channeling {name}",
        "mic check one two like {name}",
        "legendary flow like {name}",
        "on the mic it's giving {name}",
        "lyrically blessed like {name}",
        "pen game crazy like {name}",
        "studio magic like {name}",
    ],
    musician: [
        "hit the stage like {name}",
        "platinum vibes just like {name}",
        "melody on point like {name}",
        "sing it from the soul like {name}",
        "chart-topping legacy {name}",
        "icon status like {name}",
    ],
    actor: [
        "oscar-worthy moves like {name}",
        "on the big screen like {name}",
        "blockbuster presence {name}",
        "starring role they call me {name}",
        "action hero mode like {name}",
        "a-list energy {name}",
    ],
    athlete: [
        "championship level {name}",
        "mvp they call me {name}",
        "hall of fame just like {name}",
        "going for the gold like {name}",
        "record-breaking like {name}",
        "undefeated like {name}",
        "clutch performance like {name}",
    ],
    historical: [
        "changed the world like {name}",
        "visionary like {name}",
        "ahead of my time like {name}",
        "revolutionary like {name}",
        "legacy of {name}",
    ],
    movie: [
        "blockbuster moment like {name}",
        "plot twist like {name}",
        "main character energy {name}",
    ],
    gameshow: [
        "winning big like {name}",
        "final round with {name}",
    ],
};

// ============================================================================
// Helper: Get all punchline phrases matching a mood
// Returns a flat array of strings ready to mix into phrase pools
// ============================================================================

// Localized phrase bank reference — set by LyricEngine before generation
let _localizedPhraseBank = null;

/**
 * Set the localized phrase bank for non-English punchlines.
 * @param {object|null} bank
 */
export function setLocalizedPunchlineBank(bank) {
    _localizedPhraseBank = bank;
}

export function getPunchlinePhrases(mood) {
    // Check for localized punchline phrases
    if (_localizedPhraseBank?.punchlines) {
        const normalizedMood = (mood || '').toLowerCase();
        const phrases = [];
        for (const familyData of Object.values(_localizedPhraseBank.punchlines)) {
            if (familyData.all) phrases.push(...familyData.all);
            if (normalizedMood && familyData[normalizedMood]) phrases.push(...familyData[normalizedMood]);
        }
        if (phrases.length > 0) return phrases;
    }

    const normalizedMood = (mood || '').toLowerCase();
    const phrases = [];

    for (const familyData of Object.values(PUNCHLINE_PHRASES)) {
        // Always include 'all' mood phrases
        if (familyData.all) {
            phrases.push(...familyData.all);
        }
        // Include mood-specific phrases
        if (normalizedMood && familyData[normalizedMood]) {
            phrases.push(...familyData[normalizedMood]);
        }
    }

    return phrases;
}

/**
 * Get punchline phrases filtered by rhyme family.
 * Useful for targeted rhyme matching.
 */
export function getPunchlinesByFamily(family, mood) {
    const normalizedMood = (mood || '').toLowerCase();

    // Check localized punchline data first
    if (_localizedPhraseBank?.punchlines) {
        const localFamily = _localizedPhraseBank.punchlines[family];
        if (localFamily) {
            const phrases = [];
            if (localFamily.all) phrases.push(...localFamily.all);
            if (normalizedMood && localFamily[normalizedMood]) {
                phrases.push(...localFamily[normalizedMood]);
            }
            if (phrases.length > 0) return phrases;
        }
    }

    const familyData = PUNCHLINE_PHRASES[family];
    if (!familyData) return [];

    const phrases = [];
    if (familyData.all) phrases.push(...familyData.all);
    if (normalizedMood && familyData[normalizedMood]) {
        phrases.push(...familyData[normalizedMood]);
    }
    return phrases;
}

/**
 * Generate a template-based punchline using a celebrity name.
 * @param {string} category - rapper, actor, athlete, etc.
 * @param {string} name - Celebrity name
 * @param {function} rng - Random number generator
 * @returns {string}
 */
export function generateTemplatePunchline(category, name, rng) {
    const templates = PUNCHLINE_TEMPLATES[category];
    if (!templates || templates.length === 0) return null;
    const template = pick(templates, rng);
    return template.replace('{name}', name);
}

/**
 * Get total count of all punchline phrases.
 */
export function getPunchlineCount() {
    let count = 0;
    for (const familyData of Object.values(PUNCHLINE_PHRASES)) {
        for (const moodPhrases of Object.values(familyData)) {
            if (Array.isArray(moodPhrases)) {
                count += moodPhrases.length;
            }
        }
    }
    return count;
}

/**
 * Check if a lyric line appears to be a punchline (contains celebrity/pop culture reference).
 * Used for scoring hit potential.
 * @param {string} line
 * @returns {boolean}
 */
export function isPunchlineLine(line) {
    // Strip cadence breaks (" - ") before matching, since addCadenceBreak
    // inserts them after generation but PunchlineBank stores phrases without them.
    const lower = line.toLowerCase().replace(/ - /g, ' ');

    // Check localized punchline data first
    if (_localizedPhraseBank?.punchlines) {
        for (const familyData of Object.values(_localizedPhraseBank.punchlines)) {
            for (const moodPhrases of Object.values(familyData)) {
                if (Array.isArray(moodPhrases)) {
                    for (const phrase of moodPhrases) {
                        if (lower === phrase.toLowerCase()) return true;
                    }
                }
            }
        }
    }

    for (const familyData of Object.values(PUNCHLINE_PHRASES)) {
        for (const moodPhrases of Object.values(familyData)) {
            if (Array.isArray(moodPhrases)) {
                for (const phrase of moodPhrases) {
                    if (lower === phrase.toLowerCase()) return true;
                }
            }
        }
    }
    return false;
}

/**
 * Count punchline lines in a set of lyric lines.
 * @param {string[]} lines
 * @returns {number}
 */
export function countPunchlineLines(lines) {
    return lines.filter(isPunchlineLine).length;
}

// =====================================================================
// MERGE EXPANSION DATA — SUPER MASSIVE PUNCHLINE EXPANSION
// =====================================================================
import { PUNCHLINE_PHRASES_EXPANSION, PUNCHLINE_TEMPLATES_EXPANSION, mergePunchlinePhrases, mergePunchlineTemplates } from './PunchlineBankExpansion';

mergePunchlinePhrases(PUNCHLINE_PHRASES, PUNCHLINE_PHRASES_EXPANSION);
mergePunchlineTemplates(PUNCHLINE_TEMPLATES, PUNCHLINE_TEMPLATES_EXPANSION);

// =====================================================================
// MERGE EXPANSION 2 DATA — 5x PUNCHLINE EXPANSION
// =====================================================================
import { PUNCHLINE_PHRASES_EXPANSION2, PUNCHLINE_TEMPLATES_EXPANSION2, mergePunchlinePhrases2, mergePunchlineTemplates2 } from './PunchlineBankExpansion2';

mergePunchlinePhrases2(PUNCHLINE_PHRASES, PUNCHLINE_PHRASES_EXPANSION2);
mergePunchlineTemplates2(PUNCHLINE_TEMPLATES, PUNCHLINE_TEMPLATES_EXPANSION2);

// =====================================================================
// MERGE EXPANSION 3 DATA — 500+ WORDPLAY & DOUBLE MEANING PUNCHLINES
// =====================================================================
import { PUNCHLINE_PHRASES_EXPANSION3, PUNCHLINE_TEMPLATES_EXPANSION3, mergePunchlinePhrases3, mergePunchlineTemplates3 } from './PunchlineBankExpansion3';

mergePunchlinePhrases3(PUNCHLINE_PHRASES, PUNCHLINE_PHRASES_EXPANSION3);
mergePunchlineTemplates3(PUNCHLINE_TEMPLATES, PUNCHLINE_TEMPLATES_EXPANSION3);

export { PUNCHLINE_PHRASES, PUNCHLINE_TEMPLATES };
