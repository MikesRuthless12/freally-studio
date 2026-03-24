/**
 * RhymeEngineExpansion3 — Third rhyme dictionary expansion.
 * Adds 200+ new words across new and expanded rhyme families.
 * Deepens lyric generation variety with fresh vocabulary.
 */

// =====================================================================
// NEW RHYME FAMILIES 3 — families not yet in base, expansion1, or expansion2
// =====================================================================
export const NEW_RHYME_FAMILIES_3 = {

    // === Consonant cluster endings ===
    'awn2': ['brawn', 'fawn', 'pawn', 'lawn', 'dawn', 'spawn', 'prawn', 'yawn', 'drawn', 'withdrawn', 'redrawn', 'overdrawn', 'foregone', 'newborn'],
    'owl': ['growl', 'howl', 'prowl', 'scowl', 'fowl', 'jowl', 'cowl', 'yowl', 'waterfowl', 'barn-owl', 'night-owl'],
    'awl': ['brawl', 'crawl', 'drawl', 'shawl', 'sprawl', 'trawl', 'wall', 'tall', 'fall', 'call', 'hall', 'ball', 'small', 'stall', 'install', 'appall', 'enthrall', 'waterfall', 'downfall', 'pitfall', 'rainfall', 'snowfall', 'windfall', 'nightfall', 'freefall', 'overall', 'overhaul', 'protocol', 'alcohol', 'aerosol', 'parasol', 'cholesterol'],
    'altz': ['waltz', 'vaults', 'faults', 'halts', 'salts', 'malts', 'assaults', 'defaults', 'exalts', 'cobalt'],
    'arf': ['scarf', 'dwarf', 'wharf', 'barf'],
    'orb': ['orb', 'absorb', 'forb', 'reabsorb'],
    'arb': ['barb', 'garb', 'rhubarb'],
    'erb': ['herb', 'verb', 'curb', 'blurb', 'perturb', 'disturb', 'superb', 'adverb', 'proverb', 'suburb', 'exurb'],
    'werp': ['twerp', 'burp', 'chirp', 'usurp'],
    'orf': ['morph', 'dwarf', 'wharf'],
    'ulch': ['mulch', 'gulch'],
    'arch': ['march', 'arch', 'starch', 'parch', 'monarch', 'matriarch', 'patriarch', 'oligarch', 'anarch'],
    'urch': ['church', 'search', 'perch', 'lurch', 'birch', 'research', 'besmirch', 'overarch'],

    // === Diphthong families ===
    'ounce': ['bounce', 'ounce', 'pounce', 'announce', 'denounce', 'pronounce', 'renounce', 'trounce', 'flounce', 'mispronounce'],
    'oint2': ['point', 'joint', 'appoint', 'anoint', 'disappoint', 'checkpoint', 'viewpoint', 'standpoint', 'gunpoint', 'counterpoint', 'needlepoint', 'knifepoint', 'pinpoint', 'flashpoint', 'ballpoint', 'endpoint'],
    'oist2': ['moist', 'hoist', 'joist', 'foist', 'rejoiced', 'voiced', 'invoiced'],

    // === Nasal endings ===
    'ank2': ['bank', 'blank', 'crank', 'dank', 'drank', 'flank', 'frank', 'plank', 'prank', 'rank', 'sank', 'shank', 'shrank', 'spank', 'stank', 'swank', 'tank', 'thank', 'yank', 'outrank', 'riverbank', 'snowbank', 'gangplank', 'fishbank', 'point-blank'],
    'enk': ['stink', 'think', 'drink', 'link', 'pink', 'sink', 'shrink', 'wink', 'blink', 'brink', 'clink', 'ink', 'kink', 'mink', 'rink', 'zinc', 'rethink', 'interlink', 'countersink', 'doublethink', 'groupthink', 'hoodwink', 'ice-rink', 'kitchen-sink'],

    // === Fricative endings ===
    'ooth': ['smooth', 'tooth', 'booth', 'soothe', 'youth', 'truth', 'sleuth', 'uncouth', 'tollbooth', 'phone-booth', 'sweet-tooth', 'sabertooth', 'half-truth', 'untruth'],
    'ithe': ['writhe', 'tithe', 'scythe', 'blithe', 'lithe'],
    'athe': ['bathe', 'swathe', 'lathe', 'scathe', 'unscathed', 'sunbathe'],

    // === Liquid consonant families ===
    'url': ['curl', 'girl', 'hurl', 'pearl', 'swirl', 'twirl', 'whirl', 'furl', 'unfurl', 'world', 'earl', 'whorl'],
    'arl': ['snarl', 'gnarl', 'carl', 'karl', 'startle', 'darling', 'marlin'],

    // === Stop consonant families ===
    'ept2': ['crept', 'kept', 'slept', 'swept', 'wept', 'stepped', 'accept', 'except', 'concept', 'intercept', 'adept', 'inept', 'overslept'],
    'ipt2': ['script', 'gripped', 'stripped', 'tripped', 'skipped', 'clipped', 'dripped', 'flipped', 'shipped', 'whipped', 'equipped', 'encrypt', 'manuscript', 'transcript', 'postscript', 'conscript', 'nondescript'],

    // === Sibilant families ===
    'usk2': ['dusk', 'husk', 'musk', 'rusk', 'tusk', 'busk', 'mollusk', 'cornhusk'],
    'osk2': ['mosque', 'kiosk'],

    // === Emotional/atmospheric families ===
    'yst2': ['gist', 'grist', 'tryst', 'cyst', 'mist', 'fist', 'wrist', 'twist', 'bliss', 'hiss', 'kiss', 'miss', 'abyss', 'dismiss', 'reminisce', 'coexist', 'prejudice'],
    'ache': ['ache', 'break', 'take', 'make', 'sake', 'wake', 'fake', 'stake', 'lake', 'headache', 'heartache', 'backache', 'bellyache', 'toothache', 'stomachache', 'earthquake'],
    'umb': ['numb', 'dumb', 'thumb', 'plumb', 'crumb', 'drum', 'strum', 'succumb', 'aplomb', 'honeycomb', 'catacomb', 'overcome', 'breadcrumb'],
    'aze4': ['blaze', 'craze', 'daze', 'gaze', 'graze', 'haze', 'maze', 'phrase', 'raze', 'ablaze', 'amaze', 'appraise', 'malaise', 'mayonnaise', 'paraphrase', 'stargazer', 'trailblazer', 'laser', 'blazer', 'razor', 'eraser'],
};

// =====================================================================
// EXPANDED EXISTING FAMILIES 3 — additional words for families that exist
// =====================================================================
export const EXPANDED_RHYME_FAMILIES_3 = {

    // === Expanding A-sound families ===
    'ight': ['recite', 'rewrite', 'expedite', 'parasite', 'meteorite', 'socialite', 'copyright', 'playwright', 'oversight', 'underwrite', 'reunite', 'extradite', 'graphite', 'termite', 'stalactite', 'stalagmite', 'antifreeze-light', 'neonlight', 'floodlight', 'penlight', 'blacklight'],
    'ay': ['relay', 'waylay', 'heyday', 'mayday', 'payday', 'midday', 'workday', 'weekday', 'getaway', 'giveaway', 'hideaway', 'runaway', 'castaway', 'faraway', 'stowaway', 'takeaway', 'throwaway', 'motorway', 'waterway', 'expressway', 'entryway', 'driveway', 'passageway', 'crochet', 'ricochet', 'cabaret', 'gourmet', 'beret'],
    'ain': ['ascertain', 'entertain', 'cellophane', 'windowpane', 'sugarcane', 'counterpane', 'monoplane', 'biplane', 'warplane', 'airplane', 'hydroplane', 'aquaplane', 'bloodstain', 'eyestrain', 'brainstorm', 'freerain', 'acid-rain'],
    'ame': ['aflame', 'rename', 'defame', 'endgame', 'wargame', 'postgame', 'pregame', 'blame-game', 'mind-game', 'hall-of-fame', 'self-blame'],
    'ace': ['grimace', 'necklace', 'solace', 'shoelace', 'workplace', 'airspace', 'namespace', 'cyberspace', 'hyperspace', 'aerospace', 'outer-space', 'rat-race', 'horse-race', 'arms-race'],
    'ade': ['stockade', 'charade', 'grenade', 'marinade', 'cavalcade', 'accolade', 'cannonade', 'colonnade', 'retrograde', 'downgrade', 'upgrade', 'nightshade', 'lampshade', 'sunshade', 'switchblade'],
    'ate': ['allocate', 'circulate', 'complicate', 'correlate', 'cultivate', 'desolate', 'dissipate', 'fluctuate', 'formulate', 'germinate', 'hibernate', 'imitate', 'inaugurate', 'liquidate', 'magistrate', 'nominate', 'perpetuate', 'procrastinate', 'retaliate', 'saturate', 'stagnate', 'stimulate', 'subordinate', 'suffocate', 'validate', 'ventilate'],

    // === Expanding E-sound families ===
    'ee': ['banshee', 'trainee', 'trustee', 'lessee', 'licensee', 'nominee', 'retiree', 'escapee', 'detainee', 'internee', 'deportee', 'abductee', 'amputee', 'divorcee', 'appointee', 'conferee', 'grantee', 'mortgagee', 'guarantee'],
    'eal': ['overkill', 'cartwheel', 'flywheel', 'pinwheel', 'steering-wheel', 'big-deal', 'raw-deal', 'no-big-deal', 'sex-appeal', 'mass-appeal', 'court-appeal'],
    'eat': ['backseat', 'car-seat', 'hot-seat', 'front-seat', 'ringside-seat', 'downbeat', 'upbeat', 'brownbeat', 'deadmeat', 'fresh-meat', 'red-meat', 'side-street', 'back-street', 'main-street', 'wall-street'],
    'eed': ['agreed', 'decreed', 'guaranteed', 'misread', 'proofread', 'godspeed', 'horsebreed', 'nosebleed', 'birdseed', 'flaxseed', 'poppyseed', 'sunflower-seed', 'centipede', 'millipede', 'stampede'],
    'eam': ['midstream', 'jetstream', 'bloodstream', 'airstream', 'slipstream', 'cold-cream', 'ice-cream', 'sour-cream', 'whipped-cream', 'pipe-dream', 'fever-dream', 'daydream'],
    'ear': ['buccaneer', 'profiteer', 'racketeer', 'musketeer', 'privateer', 'puppeteer', 'pamphleteer', 'commandeer', 'gondolier', 'brigadier', 'grenadier', 'bombardier', 'financier', 'cashier'],
    'ess': ['ageless', 'boneless', 'borderless', 'bottomless', 'boundless', 'brainless', 'breathless', 'changeless', 'classless', 'cloudless', 'colorless', 'countless', 'defenseless', 'faceless', 'faithless', 'fatherless', 'faultless', 'formless', 'fruitless', 'gutless', 'humorless', 'lawless', 'lifeless', 'loveless', 'mindless', 'nameless', 'painless', 'pointless', 'purposeless', 'regardless', 'rootless', 'scoreless', 'seamless', 'shapeless', 'sinless', 'skinless', 'smokeless', 'soulless', 'soundless', 'spineless', 'stainless', 'tasteless', 'thankless', 'toneless', 'topless', 'trackless', 'useless', 'valueless', 'voiceless', 'wordless', 'worthless'],

    // === Expanding I-sound families ===
    'ine': ['alkaline', 'aquiline', 'asinine', 'bovine', 'canine', 'divine', 'equine', 'feline', 'genuine', 'iodine', 'leonine', 'lupine', 'palatine', 'pristine', 'routine', 'saline', 'supine', 'benign', 'malign', 'resign', 'woodbine', 'grapevine'],
    'ide': ['curbside', 'lakeside', 'poolside', 'trackside', 'wayside', 'dockside', 'broadside', 'blindside', 'backside', 'offside', 'onside', 'stateside', 'nationwide', 'statewide', 'citywide', 'worldwide', 'oceanwide', 'cyanide', 'fluoride', 'chloride', 'peroxide', 'monoxide', 'herbicide', 'fungicide', 'insecticide', 'fratricide', 'infanticide', 'regicide'],
    'ive': ['captive', 'motive', 'native', 'active', 'festive', 'restive', 'furtive', 'fugitive', 'cognitive', 'addictive', 'collective', 'connective', 'corrective', 'defective', 'directive', 'distinctive', 'elective', 'exclusive', 'exhaustive', 'inclusive', 'instructive', 'intensive', 'inventive', 'objective', 'offensive', 'oppressive', 'permissive', 'persuasive', 'possessive', 'predictive', 'reflective', 'selective', 'submissive', 'successive', 'vindictive'],
    'ime': ['enzyme', 'ragtime', 'peacetime', 'wartime', 'dinnertime', 'lunchtime', 'downtime', 'airtime', 'primetime', 'full-time', 'part-time', 'real-time', 'old-time', 'big-time', 'small-time', 'two-time', 'pantomime'],

    // === Expanding O-sound families ===
    'ow': ['bungalow', 'afterglow', 'crossbow', 'elbow', 'longbow', 'rainbow', 'scarecrow', 'tiptoe', 'mistletoe', 'domino', 'fiasco', 'gusto', 'lingo', 'limbo', 'memo', 'motto', 'patio', 'piano', 'placebo', 'rodeo', 'silo', 'stereo', 'video', 'cameo', 'ratio', 'radio'],
    'old': ['bankrolled', 'consoled', 'extolled', 'cajoled', 'enrolled', 'paroled', 'patrolled', 'blindfolded', 'ice-cold', 'stone-cold', 'rock-solid', 'pot-of-gold', 'heart-of-gold'],
    'one': ['alone', 'atone', 'condone', 'enthrone', 'intone', 'baritone', 'chaperone', 'earphone', 'headphone', 'cellphone', 'smartphone', 'megaphone', 'xylophone', 'gramophone', 'homophone', 'interphone', 'semitone', 'undertone', 'overtone', 'monotone', 'capstone', 'sandstone', 'brownstone', 'flagstone', 'grindstone', 'curbstone', 'lodestone'],
    'ore': ['carnivore', 'omnivore', 'ancestor', 'chancellor', 'corridor', 'emperor', 'gladiator', 'governor', 'senator', 'warrior', 'matador', 'ambassador', 'bachelor', 'competitor', 'conqueror', 'counselor', 'janitor', 'mediator', 'navigator', 'predator', 'spectator', 'supervisor', 'troubadour'],
    'ound': ['turnaround', 'runaround', 'merry-go-round', 'year-round', 'all-around', 'wraparound', 'lost-and-found', 'iron-bound', 'duty-bound', 'muscle-bound', 'leather-bound', 'fog-bound', 'desk-bound', 'storm-bound', 'house-bound', 'weather-bound'],

    // === Expanding U-sound families ===
    'ue': ['fondue', 'bayou', 'bijou', 'caribou', 'rendezvous', 'impromptu', 'hullabaloo', 'ballyhoo', 'bugaboo', 'cockatoo', 'didgeridoo', 'peekaboo', 'switcheroo', 'buckaroo', 'wahoo', 'yahoo', 'voodoo', 'hoodoo', 'kung-fu', 'jiu-jitsu', 'sudoku'],
    'ust': ['locust', 'nonplussed', 'readjust', 'antitrust', 'upper-crust', 'gold-dust', 'angel-dust', 'fairy-dust', 'biting-dust', 'mega-thrust', 'power-thrust'],
    'ull': ['pitiful', 'dutiful', 'fanciful', 'frightful', 'fruitful', 'gleeful', 'hurtful', 'joyful', 'lawful', 'lustful', 'mindful', 'needful', 'painful', 'prayerful', 'prideful', 'regretful', 'resentful', 'revengeful', 'rightful', 'scornful', 'sinful', 'skillful', 'slothful', 'soulful', 'spiteful', 'stressful', 'tearful', 'thankful', 'thoughtful', 'trustful', 'truthful', 'tuneful', 'vengeful', 'watchful', 'willful', 'wishful', 'woeful', 'wrathful', 'youthful', 'zestful'],

    // === Expanding other families ===
    'ell': ['bombshell', 'citadel', 'clientele', 'cockle-shell', 'decibel', 'dumbbell', 'inkwell', 'outsell', 'oversell', 'stairwell', 'unwell', 'wishing-well', "ne'er-do-well"],
    'end': ['amend', 'befriend', 'bookend', 'commend', 'condescend', 'fend', 'fiend', 'godsend', 'offend', 'rend', 'suspend', 'tail-end', 'trend-bend', 'loose-end', 'dead-end', 'year-end', 'high-end', 'low-end', 'front-end', 'back-end', 'split-end'],
    'ong': ['ding-dong', 'ping-pong', 'sing-along', 'carry-on', 'hereupon', 'thereupon', 'whereupon', 'baton', 'neon', 'python', 'marathon', 'decathlon', 'triathlon', 'pentagon', 'hexagon', 'octagon', 'paragon', 'phenomenon'],
    'orn': ['airborne', 'careworn', 'firstborn', 'foreign-born', 'freeborn', 'highborn', 'inborn', 'lastborn', 'lovelorn', 'lowborn', 'seaborne', 'shopworn', 'stillborn', 'timeworn', 'unborn', 'waterborne', 'weatherworn', 'wellborn'],

    // === Expanding consonant families ===
    'ance': ['acquaintance', 'continuance', 'contrivance', 'conveyance', 'countenance', 'deliverance', 'dissonance', 'disturbance', 'exuberance', 'forbearance', 'hindrance', 'maintenance', 'nonchalance', 'nuisance', 'observance', 'ordinance', 'perseverance', 'pertinence', 'protuberance', 'reconnaissance', 'remonstrance', 'repentance', 'resemblance', 'severance', 'sustenance', 'temperance', 'utterance'],
    'ense': ['audience', 'cadence', 'competence', 'confidence', 'consequence', 'correspondence', 'decadence', 'dependence', 'difference', 'diligence', 'eloquence', 'emergence', 'eminence', 'evidence', 'excellence', 'existence', 'experience', 'influence', 'innocence', 'intelligence', 'magnificence', 'negligence', 'obedience', 'occurrence', 'patience', 'persistence', 'preference', 'prominence', 'providence', 'reference', 'residence', 'sequence', 'silence', 'turbulence', 'violence'],
    'ist': ['anarchist', 'archivist', 'biologist', 'botanist', 'capitalist', 'cartoonist', 'classicist', 'columnist', 'communist', 'conformist', 'darwinist', 'dramatist', 'economist', 'essayist', 'evangelist', 'exorcist', 'extremist', 'fatalist', 'finalist', 'futurist', 'geneticist', 'hedonist', 'hypnotist', 'illusionist', 'imperialist', 'lobbyist', 'masochist', 'methodist', 'minimalist', 'monarchist', 'nihilist', 'pacifist', 'perfectionist', 'philanthropist', 'populist', 'protagonist', 'publicist', 'purist', 'sadist', 'surrealist', 'survivalist', 'violinist'],
};

// =====================================================================
// MERGE FUNCTION
// =====================================================================
export function mergeRhymeFamilies3(existing, newFamilies, expandedFamilies) {
    for (const [family, words] of Object.entries(newFamilies)) {
        if (!existing[family]) {
            existing[family] = words;
        } else {
            const set = new Set(existing[family].map(w => w.toLowerCase()));
            for (const word of words) {
                if (!set.has(word.toLowerCase())) existing[family].push(word);
            }
        }
    }
    for (const [family, words] of Object.entries(expandedFamilies)) {
        if (existing[family]) {
            const set = new Set(existing[family].map(w => w.toLowerCase()));
            for (const word of words) {
                if (!set.has(word.toLowerCase())) existing[family].push(word);
            }
        } else {
            existing[family] = words;
        }
    }
}
