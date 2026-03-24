/**
 * RhymeEngine — Phonetic-ending-based rhyme matching system.
 * Detects last stressed vowel sounds and matches phonetic endings.
 * Supports AABB, ABAB, AAAA, and Freeform rhyme schemes.
 */

// Phonetic ending groups — words sharing the same group rhyme
// Massively expanded dictionary for rich lyric generation
const RHYME_FAMILIES = {
    // === A-sounds ===
    'ight': ['light', 'night', 'fight', 'right', 'bright', 'sight', 'flight', 'might', 'tight', 'height', 'delight', 'ignite', 'tonight', 'midnight', 'moonlight', 'sunlight', 'starlight', 'spotlight', 'twilight', 'daylight', 'recite', 'excite', 'unite', 'polite', 'rewrite', 'insight', 'foresight', 'forthright', 'outright', 'uptight', 'alight', 'dynamite', 'satellite', 'kite', 'white', 'knight', 'bite', 'quite', 'spite', 'plight', 'blight', 'trite', 'mite', 'site', 'rite', 'smite', 'contrite', 'hindsight', 'oversight', 'limelight', 'highlight', 'flashlight', 'searchlight', 'firelight', 'candlelight'],
    'ay': ['day', 'way', 'say', 'play', 'stay', 'away', 'today', 'okay', 'display', 'betray', 'delay', 'convey', 'relay', 'sway', 'pray', 'grey', 'hooray', 'runway', 'decay', 'dismay', 'essay', 'portray', 'survey', 'gateway', 'highway', 'hallway', 'pathway', 'doorway', 'stairway', 'railway', 'birthday', 'holiday', 'yesterday', 'everyday', 'halfway', 'outweigh', 'repay', 'obey', 'replay', 'array', 'bouquet', 'ballet', 'cafe', 'filet', 'soiree', 'ray', 'bay', 'clay', 'hay', 'jay', 'lay', 'may', 'pay', 'spray', 'stray', 'weigh', 'sleigh', 'prey', 'fray', 'tray', 'dre', 'beyonce', 'kanye'],
    'ain': ['rain', 'pain', 'chain', 'brain', 'train', 'gain', 'main', 'remain', 'contain', 'explain', 'sustain', 'refrain', 'domain', 'maintain', 'campaign', 'complain', 'insane', 'vain', 'plain', 'strain', 'drain', 'crane', 'lane', 'cane', 'sane', 'bane', 'mane', 'wane', 'pane', 'feign', 'reign', 'detain', 'obtain', 'retain', 'restrain', 'constrain', 'attain', 'entertain', 'hurricane', 'membrane', 'airplane', 'champagne', 'terrain', 'mundane', 'humane', 'migraine', 'profane', 'arcane', 'disdain', 'abstain', 'ordain', 'proclaim', 'wayne', 'cobain', 'twain'],
    'ame': ['name', 'flame', 'game', 'same', 'blame', 'fame', 'shame', 'came', 'frame', 'claim', 'became', 'proclaim', 'reclaim', 'exclaim', 'overcame', 'tame', 'lame', 'aim', 'dame', 'maim', 'acclaim', 'inflame', 'disclaim', 'mainframe', 'timeframe', 'ballgame', 'surname', 'nickname', 'filename', 'username', 'boardgame'],
    'ace': ['face', 'place', 'space', 'race', 'grace', 'trace', 'embrace', 'replace', 'erase', 'misplace', 'palace', 'surface', 'base', 'case', 'chase', 'pace', 'lace', 'ace', 'disgrace', 'displace', 'commonplace', 'marketplace', 'workspace', 'birthplace', 'fireplace', 'staircase', 'showcase', 'suitcase', 'briefcase', 'bookcase', 'database', 'interface', 'interlace', 'scarface', 'ghostface'],
    'ade': ['made', 'fade', 'shade', 'blade', 'trade', 'grade', 'cascade', 'arcade', 'evade', 'invade', 'persuade', 'parade', 'crusade', 'tirade', 'decade', 'blockade', 'lemonade', 'serenade', 'masquerade', 'barricade', 'escapade', 'promenade', 'renegade', 'aid', 'paid', 'laid', 'raid', 'maid', 'braid', 'afraid', 'displayed', 'betrayed', 'delayed', 'conveyed', 'dismayed', 'portrayed', 'decayed', 'obeyed', 'surveyed', 'handmade', 'homemade'],
    'ate': ['late', 'fate', 'gate', 'hate', 'state', 'wait', 'great', 'mate', 'plate', 'date', 'rate', 'straight', 'weight', 'eight', 'freight', 'bait', 'trait', 'create', 'debate', 'relate', 'translate', 'generate', 'celebrate', 'separate', 'dominate', 'illuminate', 'fascinate', 'captivate', 'devastate', 'elevate', 'appreciate', 'communicate', 'demonstrate', 'eliminate', 'concentrate', 'hesitate', 'navigate', 'radiate', 'contemplate', 'motivate', 'dedicate', 'resonate', 'calculate', 'liberate', 'integrate', 'terminate', 'compensate', 'anticipate', 'originate', 'evaporate', 'accelerate', 'alleviate', 'incarcerate', 'investigate', 'manipulate', 'obliterate', 'tolerate', 'gravitate', 'activate', 'elaborate', 'meditate', 'orchestrate', 'participate', 'escalate', 'accumulate', 'accommodate', 'cooperate', 'decorate', 'educate', 'evaluate', 'exaggerate', 'fabricate', 'graduate', 'illustrate', 'incorporate', 'irritate', 'negotiate', 'operate', 'penetrate', 'regulate', 'simulate', 'violate'],
    'ake': ['make', 'take', 'break', 'wake', 'shake', 'lake', 'sake', 'fake', 'stake', 'mistake', 'awake', 'earthquake', 'heartbreak', 'snowflake', 'daybreak', 'handshake', 'overtake', 'undertake', 'namesake', 'keepsake', 'cupcake', 'milkshake', 'intake', 'partake', 'forsake', 'remake', 'opaque', 'drake'],
    'ale': ['tale', 'scale', 'pale', 'whale', 'sail', 'trail', 'rail', 'mail', 'fail', 'tail', 'jail', 'bail', 'nail', 'hail', 'frail', 'prevail', 'detail', 'exhale', 'inhale', 'reveal', 'unveil', 'curtail', 'derail', 'wholesale', 'nightingale', 'fairytale', 'cocktail', 'ponytail', 'handrail', 'guardrail', 'fingernail', 'monorail', 'email', 'female', 'male'],

    // === E-sounds ===
    // NOTE: Removed words with unstressed final -y (harmony, melody, energy, destiny, etc.)
    // and -ory (history, memory, victory, territory, etc.) — they don't rhyme with stressed "-ee".
    // "history" ≠ "free". Those words are in the 'ory' family instead.
    'ee': ['free', 'me', 'see', 'be', 'tree', 'key', 'agree', 'debris', 'degree', 'guarantee', 'sea', 'tea', 'plea', 'flea', 'knee', 'three', 'fee', 'spree', 'decree', 'referee', 'refugee', 'employee', 'absentee', 'addressee', 'devotee', 'jubilee', 'filigree', 'pedigree', 'chimpanzee', 'manatee', 'lee', 'ali', 'bruce lee'],
    'eal': ['feel', 'real', 'deal', 'heal', 'steal', 'reveal', 'seal', 'meal', 'wheel', 'steel', 'kneel', 'peel', 'reel', 'appeal', 'conceal', 'ideal', 'surreal', 'ordeal', 'unreal', 'cornfield', 'battlefield', 'windshield', 'automobile', 'genteel', 'zeal', 'congeal', 'repeal', 'commonweal', 'oneal', 'shaquille'],
    'eat': ['beat', 'heat', 'street', 'sweet', 'meet', 'seat', 'treat', 'repeat', 'defeat', 'compete', 'complete', 'concrete', 'discreet', 'elite', 'receipt', 'heartbeat', 'deadbeat', 'drumbeat', 'offbeat', 'bittersweet', 'obsolete', 'fleet', 'feat', 'wheat', 'cheat', 'neat', 'greet', 'retreat', 'delete', 'discrete', 'deplete'],
    'eed': ['need', 'bleed', 'speed', 'feed', 'lead', 'read', 'seed', 'freed', 'agreed', 'exceed', 'succeed', 'proceed', 'indeed', 'breed', 'creed', 'greed', 'deed', 'weed', 'heed', 'concede', 'precede', 'stampede', 'guaranteed', 'centipede'],
    'eam': ['dream', 'stream', 'team', 'seem', 'scheme', 'extreme', 'supreme', 'esteem', 'regime', 'redeem', 'beam', 'cream', 'gleam', 'scream', 'steam', 'theme', 'seam', 'mainstream', 'downstream', 'upstream', 'daydream', 'moonbeam', 'sunbeam', 'ice cream', 'self-esteem', 'blaspheme', 'ream'],
    'ear': ['hear', 'fear', 'near', 'clear', 'year', 'dear', 'tear', 'appear', 'disappear', 'atmosphere', 'frontier', 'pioneer', 'sincere', 'severe', 'persevere', 'here', 'mere', 'peer', 'beer', 'steer', 'cheer', 'sheer', 'veer', 'gear', 'rear', 'spear', 'career', 'volunteer', 'engineer', 'souvenir', 'chandelier', 'hemisphere', 'stratosphere', 'interfere', 'domineer', 'auctioneer', 'mountaineer', 'cavalier', 'premiere', 'revere'],
    'ess': ['less', 'bless', 'mess', 'guess', 'stress', 'address', 'confess', 'express', 'possess', 'impress', 'progress', 'success', 'darkness', 'weakness', 'kindness', 'madness', 'press', 'dress', 'chess', 'caress', 'obsess', 'assess', 'compress', 'depress', 'suppress', 'transgress', 'profess', 'recess', 'excess', 'process', 'access', 'princess', 'fortress', 'business', 'happiness', 'loneliness', 'wilderness', 'consciousness', 'forgiveness', 'recklessness', 'breathlessness', 'fearlessness', 'relentlessness', 'togetherness', 'tenderness', 'bitterness', 'finesse', 'distress', 'unless', 'careless', 'ceaseless', 'countless', 'dauntless', 'doubtless', 'effortless', 'endless', 'fearless', 'flawless', 'groundless', 'harmless', 'heartless', 'helpless', 'homeless', 'hopeless', 'limitless', 'meaningless', 'motionless', 'needless', 'priceless', 'relentless', 'restless', 'ruthless', 'selfless', 'senseless', 'sleepless', 'speechless', 'timeless', 'weightless', 'witness', 'goddess'],
    'est': ['best', 'rest', 'test', 'chest', 'west', 'quest', 'nest', 'guest', 'blessed', 'contest', 'protest', 'request', 'suggest', 'invest', 'harvest', 'interest', 'manifest', 'conquest', 'northwest', 'southwest', 'northeast', 'southeast', 'forest', 'modest', 'honest', 'earnest', 'conquest', 'arrest', 'digest', 'detest', 'infest'],
    'ell': ['tell', 'well', 'hell', 'shell', 'bell', 'fell', 'spell', 'smell', 'sell', 'dwell', 'swell', 'yell', 'cell', 'farewell', 'rebel', 'excel', 'compel', 'expel', 'propel', 'repel', 'dispel', 'gazelle', 'motel', 'hotel', 'carousel', 'parallel', 'personnel', 'sentinel', 'infidel', 'eggshell', 'nutshell', 'seashell', 'bombshell', 'doorbell', 'cowbell', 'bluebell', 'denzel', 'chappelle', 'pharrell'],
    'end': ['end', 'friend', 'send', 'spend', 'bend', 'blend', 'trend', 'mend', 'lend', 'defend', 'offend', 'pretend', 'attend', 'extend', 'intend', 'contend', 'depend', 'transcend', 'descend', 'recommend', 'comprehend', 'apprehend', 'dividend', 'boyfriend', 'girlfriend', 'weekend', 'legend', 'godsend', 'dead-end'],

    // === I-sounds ===
    'ine': ['mine', 'shine', 'fine', 'line', 'sign', 'wine', 'divine', 'define', 'combine', 'design', 'decline', 'refine', 'align', 'outline', 'skyline', 'sunshine', 'moonshine', 'entwine', 'vine', 'pine', 'dine', 'spine', 'shrine', 'confine', 'incline', 'recline', 'assign', 'resign', 'consign', 'enshrine', 'intertwine', 'undermine', 'valentine', 'concubine', 'porcupine', 'turpentine', 'medicine', 'magazine', 'trampoline', 'figurine', 'submarine', 'quarantine', 'tambourine', 'gasoline', 'limousine', 'tangerine', 'crystalline', 'serpentine', 'borderline', 'centerline', 'frontline', 'deadline', 'headline', 'sideline', 'guideline', 'timeline', 'pipeline', 'lifeline', 'baseline', 'hotline', 'offline', 'online', 'clothesline', 'streamline', 'shoreline', 'treeline', 'beeline', 'storyline', 'discipline', 'feminine', 'masculine', 'determine', 'imagine', 'coastline', 'landmine', 'mainline', 'underline', 'woodline', 'superfine', 'einstein'],
    'ide': ['ride', 'side', 'hide', 'wide', 'guide', 'pride', 'slide', 'inside', 'outside', 'decide', 'provide', 'divide', 'confide', 'collide', 'worldwide', 'tide', 'bride', 'stride', 'glide', 'tried', 'cried', 'dried', 'died', 'lied', 'tied', 'applied', 'denied', 'supplied', 'replied', 'implied', 'relied', 'survived', 'arrived', 'thrived', 'derived', 'deprived', 'revived', 'alongside', 'countryside', 'fireside', 'roadside', 'seaside', 'bedside', 'hillside', 'ringside', 'riverside', 'mountainside', 'downside', 'upside', 'landslide', 'mudslide', 'genocide', 'homicide', 'pesticide', 'suicide', 'coincide', 'override', 'subdivide'],
    'ire': ['fire', 'desire', 'higher', 'wire', 'inspire', 'admire', 'retire', 'empire', 'conspire', 'entire', 'require', 'enquire', 'perspire', 'transpire', 'hire', 'tire', 'acquire', 'expire', 'inquire', 'liar', 'flyer', 'buyer', 'dryer', 'choir', 'crossfire', 'campfire', 'gunfire', 'wildfire', 'hellfire', 'ceasefire', 'misfire', 'bonfire', 'backfire', 'surefire', 'rapid-fire', 'spitfire', 'vampire', 'sapphire', 'umpire', 'rewire', 'attire'],
    'ive': ['alive', 'drive', 'survive', 'thrive', 'arrive', 'revive', 'derive', 'strive', 'archive', 'forgive', 'give', 'live', 'five', 'dive', 'hive', 'jive', 'connive', 'deprive', 'contrive', 'nosedive', 'overdrive', 'skydive', 'high-five', 'beehive', 'creative', 'massive', 'passive', 'explosive', 'expressive', 'impressive', 'aggressive', 'progressive', 'excessive', 'perspective', 'alternative', 'competitive', 'conservative', 'cooperative', 'cumulative', 'decorative', 'definitive', 'destructive', 'detective', 'diminutive', 'effective', 'executive', 'figurative', 'fugitive', 'imaginative', 'imperative', 'indicative', 'initiative', 'innovative', 'instinctive', 'intuitive', 'legislative', 'locomotive', 'narrative', 'negative', 'objective', 'operative', 'positive', 'primitive', 'productive', 'protective', 'provocative', 'receptive', 'relative', 'representative', 'reproductive', 'respective', 'responsive', 'sensitive', 'subjective', 'suggestive', 'supportive'],
    'ime': ['time', 'rhyme', 'climb', 'crime', 'prime', 'dime', 'lime', 'chime', 'mime', 'sublime', 'lifetime', 'nighttime', 'daytime', 'sometime', 'overtime', 'anytime', 'bedtime', 'springtime', 'wintertime', 'summertime', 'halftime', 'pastime', 'paradigm', 'pantomime', 'maritime', 'overtime'],
    'ind': ['mind', 'find', 'kind', 'blind', 'bind', 'wind', 'behind', 'remind', 'rewind', 'unwind', 'grind', 'defined', 'designed', 'combined', 'aligned', 'resigned', 'declined', 'refined', 'confined', 'assigned', 'mankind', 'unkind', 'mastermind', 'humankind', 'colorblind', 'intertwined', 'undermined'],

    // === O-sounds ===
    'ow': ['know', 'go', 'show', 'flow', 'grow', 'glow', 'below', 'follow', 'shadow', 'window', 'tomorrow', 'sorrow', 'hollow', 'overflow', 'rainbow', 'echo', 'hero', 'zero', 'blow', 'slow', 'snow', 'throw', 'row', 'low', 'bow', 'toe', 'foe', 'woe', 'so', 'no', 'pro', 'ago', 'also', 'cargo', 'solo', 'motto', 'photo', 'disco', 'tempo', 'volcano', 'tornado', 'buffalo', 'domino', 'dynamo', 'embryo', 'flamingo', 'indigo', 'inferno', 'manifesto', 'portfolio', 'scenario', 'studio', 'torpedo', 'vertigo', 'undertow', 'overthrow', 'outgrow', 'bestow', 'elbow', 'sparrow', 'meadow', 'pillow', 'willow', 'borrow', 'narrow', 'arrow', 'shallow', 'mellow', 'yellow', 'fellow', 'cello'],
    'old': ['gold', 'hold', 'told', 'cold', 'bold', 'sold', 'fold', 'unfold', 'behold', 'untold', 'withhold', 'controlled', 'consoled', 'enrolled', 'old', 'mold', 'rolled', 'strolled', 'patrolled', 'household', 'threshold', 'scaffold', 'manifold', 'blindfold', 'stronghold', 'foothold', 'uphold', 'foretold', 'marigold'],
    'one': ['alone', 'phone', 'bone', 'stone', 'tone', 'zone', 'throne', 'known', 'grown', 'shown', 'blown', 'own', 'home', 'dome', 'chrome', 'roam', 'foam', 'poem', 'gnome', 'microphone', 'telephone', 'saxophone', 'milestone', 'cornerstone', 'limestone', 'tombstone', 'gravestone', 'stepping-stone', 'cobblestone', 'keystone', 'backbone', 'trombone', 'headstone', 'cyclone', 'ozone', 'monotone', 'silicone', 'hormone', 'timezone', 'ringtone', 'warzone', 'cologne', 'postpone', 'dethrone', 'unknown', 'overgrown', 'homegrown', 'outgrown', 'capone', 'stallone', 'malone'],
    'ose': ['close', 'rose', 'chose', 'those', 'nose', 'froze', 'suppose', 'compose', 'dispose', 'expose', 'oppose', 'propose', 'enclose', 'dose', 'hose', 'pose', 'prose', 'impose', 'disclose', 'diagnose', 'decompose', 'predispose', 'transpose', 'overdose', 'comatose', 'grandiose', 'purpose', 'glucose', 'verbose', 'morose', 'lacrosse', 'primrose'],
    'ore': ['more', 'before', 'core', 'floor', 'door', 'shore', 'explore', 'ignore', 'restore', 'adore', 'implore', 'deplore', 'forevermore', 'evermore', 'store', 'pour', 'score', 'war', 'roar', 'soar', 'four', 'bore', 'wore', 'tore', 'snore', 'lore', 'gore', 'furthermore', 'anymore', 'offshore', 'onshore', 'seashore', 'folklore', 'outdoor', 'indoor', 'trapdoor', 'backdoor', 'encore', 'decor', 'mentor', 'metaphor', 'dinosaur', 'carnivore', 'herbivore', 'sophomore', 'underscore', 'overstore', 'drugstore', 'bookstore'],
    'ong': ['song', 'long', 'strong', 'wrong', 'along', 'belong', 'lifelong', 'prolong', 'gone', 'dawn', 'drawn', 'withdrawn', 'foregone', 'bygone', 'woebegone', 'headstrong', 'armstrong', 'singalong', 'tagalong', 'furlong', 'oblong', 'yearlong', 'daylong', 'nightlong', 'weeklong'],
    'ound': ['sound', 'ground', 'found', 'round', 'bound', 'around', 'profound', 'surround', 'compound', 'background', 'underground', 'playground', 'rebound', 'astound', 'wound', 'mound', 'hound', 'pound', 'crowned', 'drowned', 'frowned', 'renowned', 'spellbound', 'earthbound', 'homebound', 'outbound', 'inbound', 'westbound', 'eastbound', 'snowbound', 'hidebound', 'dumbfound', 'confound', 'expound', 'propound', 'resound', 'battleground', 'fairground', 'campground', 'foreground', 'bloodhound', 'greyhound', 'stoneground', 'newfound', 'unbound', 'gowned', 'browned'],
    'ose2': ['ghost', 'most', 'post', 'host', 'coast', 'toast', 'boast', 'roast', 'almost', 'utmost', 'foremost', 'innermost', 'outermost', 'uppermost', 'topmost', 'signpost', 'goalpost', 'bedpost', 'doorpost', 'outpost', 'lamppost', 'compost', 'diagnosed', 'engrossed'],
    'orn': ['born', 'torn', 'worn', 'sworn', 'horn', 'storm', 'form', 'warm', 'charm', 'harm', 'arm', 'farm', 'alarm', 'disarm', 'reform', 'transform', 'perform', 'inform', 'conform', 'uniform', 'platform', 'brainstorm', 'thunderstorm', 'snowstorm', 'firestorm', 'hailstorm', 'firstborn', 'newborn', 'reborn', 'stubborn', 'forlorn', 'popcorn', 'unicorn', 'longhorn', 'foghorn', 'acorn'],
    'ope': ['hope', 'rope', 'scope', 'cope', 'slope', 'nope', 'pope', 'dope', 'grope', 'elope', 'envelope', 'telescope', 'microscope', 'horoscope', 'kaleidoscope', 'stethoscope', 'periscope', 'antelope', 'cantaloupe', 'tightrope', 'downslope'],

    // === U-sounds ===
    'ue': ['true', 'blue', 'new', 'through', 'you', 'too', 'who', 'do', 'pursue', 'rescue', 'continue', 'venue', 'statue', 'virtue', 'avenue', 'review', 'renew', 'few', 'view', 'knew', 'grew', 'flew', 'drew', 'brew', 'crew', 'clue', 'glue', 'due', 'sue', 'hue', 'cue', 'queue', 'argue', 'value', 'issue', 'tissue', 'revenue', 'residue', 'interview', 'overdue', 'breakthrough', 'overview', 'preview', 'corkscrew', 'misconstrue', 'barbecue', 'debut', 'taboo', 'bamboo', 'shampoo', 'tattoo', 'voodoo', 'kangaroo', 'igloo', 'guru', 'tofu', 'tutu'],
    'ust': ['trust', 'dust', 'must', 'just', 'bust', 'gust', 'adjust', 'disgust', 'robust', 'combust', 'wanderlust', 'rust', 'crust', 'thrust', 'discussed', 'distrust', 'mistrust', 'entrust', 'stardust', 'sawdust', 'bloodlust', 'unjust', 'august', 'exhaust'],
    'urn': ['burn', 'turn', 'learn', 'return', 'concern', 'discern', 'yearn', 'earn', 'overturn', 'churn', 'fern', 'stern', 'modern', 'pattern', 'western', 'eastern', 'northern', 'southern', 'lantern', 'cistern', 'nocturnal', 'intern', 'external', 'internal', 'eternal', 'maternal', 'paternal', 'fraternal', 'nocturne', 'saturn', 'sojourn', 'adjourn', 'sunburn', 'heartburn', 'windburn', 'downturn', 'upturn'],
    'ull': ['full', 'pull', 'bull', 'skull', 'dull', 'hull', 'gull', 'lull', 'null', 'mull', 'cull', 'annul', 'beautiful', 'wonderful', 'powerful', 'grateful', 'faithful', 'hopeful', 'peaceful', 'cheerful', 'playful', 'graceful', 'wasteful', 'shameful', 'meaningful', 'plentiful', 'merciful', 'wrathful', 'doubtful', 'mournful', 'dreadful', 'sorrowful', 'bountiful', 'resourceful', 'respectful', 'successful', 'distasteful', 'ungrateful', 'unfaithful', 'disrespectful'],
    'uck': ['luck', 'stuck', 'truck', 'struck', 'chuck', 'pluck', 'buck', 'tuck', 'muck', 'construct', 'instruct', 'destruct', 'starstruck', 'thunderstruck', 'awestruck', 'dumbstruck', 'potluck', 'up', 'cup', 'sup', 'erupt', 'corrupt', 'abrupt', 'disrupt', 'interrupt', 'bankrupt', 'setup', 'lineup', 'makeup', 'breakup', 'startup', 'holdup', 'roundup', 'mixup', 'backup', 'cleanup', 'popup', 'ketchup', 'hiccup', 'buttercup', 'lockup', 'hookup', 'checkup', 'coverup', 'pickup', 'crackup', 'hangup', 'linkup', 'pushup', 'shakeup', 'stackup', 'wakeup', 'warmup', 'bluff', 'stuff', 'rough', 'tough', 'enough', 'cuff', 'puff', 'buff', 'huff', 'rebuff', 'gruff', 'scuff', 'fluff', 'snuff'],
    'ung': ['young', 'tongue', 'sung', 'hung', 'lung', 'rung', 'flung', 'clung', 'stung', 'sprung', 'swung', 'unsung', 'among', 'strung', 'wrung', 'slung', 'outsung', 'hamstrung', 'high-strung'],
    'un': ['sun', 'run', 'fun', 'gun', 'one', 'done', 'son', 'won', 'none', 'ton', 'stun', 'begun', 'someone', 'everyone', 'anyone', 'overcome', 'undone', 'outrun', 'rerun', 'homerun', 'handgun', 'shotgun', 'machine-gun', 'pun'],

    // === Remaining sounds ===
    'ar': ['star', 'far', 'car', 'bar', 'jar', 'tar', 'scar', 'guitar', 'cigar', 'bazaar', 'radar', 'avatar', 'seminar', 'superstar', 'memoir', 'reservoir', 'registrar', 'handlebar', 'crowbar', 'sidebar', 'rebar', 'boxcar', 'streetcar', 'railcar', 'pulsar', 'tsar', 'ajar', 'afar', 'au-revoir', 'bizarre', 'caviar', 'memoir', 'nightjar', 'similar', 'particular', 'spectacular', 'popular', 'regular', 'familiar', 'lamar'],
    'ass': ['glass', 'pass', 'grass', 'mass', 'class', 'brass', 'gas', 'last', 'fast', 'past', 'cast', 'vast', 'blast', 'mast', 'contrast', 'forecast', 'broadcast', 'outcast', 'steadfast', 'overcast', 'downcast', 'aghast', 'outlast', 'unsurpassed', 'surpass', 'bypass', 'trespass', 'overpass', 'hourglass', 'looking-glass', 'fiberglass', 'stained-glass', 'compass', 'morass'],
    'aze': ['haze', 'gaze', 'blaze', 'daze', 'maze', 'phase', 'craze', 'graze', 'praise', 'raise', 'amaze', 'days', 'ways', 'plays', 'stays', 'rays', 'strays', 'displays', 'delays', 'betrays', 'always', 'highways', 'hallways', 'pathways', 'doorways', 'railways', 'birthdays', 'holidays', 'ablaze', 'rephrase', 'paraphrase', 'appraise', 'malaise'],
    'out': ['out', 'about', 'shout', 'doubt', 'throughout', 'without', 'scout', 'drought', 'sprout', 'clout', 'devout', 'lookout', 'standout', 'knockout', 'dropout', 'burnout', 'checkout', 'breakout', 'fallout', 'hideout', 'layout', 'turnout', 'workout', 'handout', 'bailout', 'blowout', 'cutout', 'holdout', 'rollout', 'sellout', 'shootout', 'shutout', 'stakeout', 'takeout', 'tryout', 'washout', 'wipeout', 'loud', 'proud', 'cloud', 'crowd', 'allowed', 'aloud', 'endowed', 'avowed', 'unbowed'],
    'ove': ['love', 'above', 'dove', 'shove', 'glove', 'thereof'],
    'uff': ['enough', 'tough', 'rough', 'stuff', 'bluff', 'cuff', 'puff', 'buff', 'huff', 'muff', 'rebuff', 'handcuff', 'gruff', 'scuff', 'fluff', 'snuff', 'overstuff'],
    'all': ['fall', 'call', 'wall', 'tall', 'small', 'ball', 'hall', 'stall', 'recall', 'install', 'overall', 'downfall', 'rainfall', 'waterfall', 'footfall', 'nightfall', 'crawl', 'drawl', 'shawl', 'brawl', 'appall', 'enthrall', 'protocol', 'overhaul', 'basketball', 'baseball', 'football', 'volleyball', 'cannonball', 'snowball', 'fireball', 'eyeball', 'pitfall', 'windfall', 'freefall', 'shortfall', 'landfall', 'pratfall', 'catcall', 'birdcall', 'alcohol', 'festival', 'carnival', 'arrival', 'survival', 'revival', 'snowfall', 'forestall', 'firewall', 'stonewall', 'wherewithal'],
    'art': ['heart', 'start', 'part', 'smart', 'apart', 'chart', 'dart', 'depart', 'restart', 'counterpart', 'sweetheart', 'art', 'cart'],
    'ark': ['dark', 'spark', 'mark', 'park', 'bark', 'shark', 'stark', 'remark', 'embark', 'disembark', 'landmark', 'hallmark', 'bookmark', 'trademark', 'birthmark', 'postmark', 'benchmark', 'watermark', 'lark', 'hark', 'arc', 'monarch', 'patriarch', 'matriarch', 'oligarch'],
    'ork': ['work', 'masterwork', 'patchwork', 'framework', 'network', 'clockwork', 'firework', 'homework', 'teamwork', 'artwork', 'handiwork', 'groundwork', 'fork', 'cork', 'stork', 'york', 'torque'],
    'and': ['hand', 'stand', 'land', 'band', 'sand', 'grand', 'brand', 'demand', 'command', 'expand', 'understand', 'withstand', 'homeland', 'dreamland', 'man', 'plan', 'can', 'fan', 'ran', 'ban', 'van', 'span', 'scan', 'clan', 'began', 'sedan', 'caravan', 'reprimand', 'contraband', 'wonderland', 'fatherland', 'motherland', 'hinterland', 'overland', 'marshland', 'farmland', 'grassland', 'wasteland', 'mainland', 'headband', 'husband', 'armband', 'wristband', 'broadband', 'rubber-band', 'firsthand', 'secondhand', 'shorthand', 'backhand', 'forehand', 'overhand', 'offhand'],
    'own': ['down', 'town', 'crown', 'drown', 'brown', 'frown', 'gown', 'renown', 'breakdown', 'sundown', 'countdown', 'showdown', 'meltdown', 'clown', 'noun', 'around', 'downtown', 'uptown', 'hometown', 'shutdown', 'lockdown', 'crackdown', 'letdown', 'slowdown', 'markdown', 'lowdown', 'knockdown', 'rundown', 'shakedown', 'takedown', 'throwdown', 'touchdown', 'turndown', 'now', 'how', 'cow', 'wow', 'pow', 'vow', 'plow', 'allow', 'endow', 'avow', 'disallow', 'bow', 'brow', 'somehow', 'anyhow', 'motown'],
    'eep': ['deep', 'keep', 'sleep', 'sweep', 'steep', 'creep', 'leap', 'heap', 'asleep', 'oversleep', 'cheap', 'sheep', 'reap', 'weep', 'seep', 'peep', 'jeep', 'beep', 'skin-deep', 'knee-deep', 'waist-deep'],
    'oul': ['soul', 'whole', 'role', 'goal', 'control', 'stroll', 'patrol', 'console', 'enroll', 'parole', 'bowl', 'roll', 'poll', 'toll', 'hole', 'pole', 'scroll', 'coal', 'fold', 'mole', 'sole', 'casserole', 'rigmarole', 'rock-and-roll', 'self-control', 'remote-control', 'tadpole', 'flagpole', 'pothole', 'loophole', 'manhole', 'pinhole', 'peephole', 'foxhole', 'sinkhole', 'butthole', 'pigeonhole', 'rabbit-hole', 'cole'],

    // === Complex endings ===
    // NOTE: The old 'tion' catch-all was removed because it falsely grouped
    // -ation, -ision, -otion, -assion as rhyming. Now split into correct families.
    'ness': ['darkness', 'weakness', 'kindness', 'madness', 'sadness', 'gladness', 'badness', 'goodness', 'boldness', 'coldness', 'fondness', 'loudness', 'hardness', 'softness', 'fitness', 'illness', 'stillness', 'fullness', 'coolness', 'awareness', 'fairness', 'closeness', 'openness', 'sweetness', 'greatness', 'lateness', 'likeness', 'loneliness', 'happiness', 'emptiness', 'gentleness', 'tenderness', 'bitterness', 'cleverness', 'eagerness', 'wilderness', 'forgiveness', 'togetherness', 'breathlessness', 'fearlessness', 'relentlessness', 'recklessness', 'sleeplessness', 'restlessness', 'helplessness', 'hopelessness', 'ruthlessness', 'worthlessness', 'carelessness', 'selflessness'],
    'ight2': ['write', 'sight', 'might', 'flight', 'light', 'knight', 'right', 'plight', 'slight', 'tight', 'fright', 'bright', 'blight', 'height'],
    'eak': ['break', 'speak', 'weak', 'peak', 'streak', 'sneak', 'freak', 'unique', 'technique', 'mystique', 'antique', 'critique', 'leak', 'beak', 'cheek', 'creek', 'geek', 'meek', 'reek', 'seek', 'sleek', 'week', 'wreak', 'tweak', 'squeak', 'boutique', 'physique', 'clique', 'oblique', 'midweek', 'workweek', 'hideandseek', 'peakaboo'],
    'ent': ['sent', 'went', 'spent', 'meant', 'bent', 'lent', 'rent', 'tent', 'vent', 'dent', 'cent', 'scent', 'event', 'prevent', 'present', 'content', 'extent', 'intent', 'consent', 'descent', 'comment', 'moment', 'movement', 'fragment', 'segment', 'element', 'document', 'monument', 'instrument', 'complement', 'supplement', 'experiment', 'environment', 'development', 'achievement', 'agreement', 'arrangement', 'department', 'measurement', 'entertainment', 'advertisement', 'acknowledgment', 'abandonment', 'announcement', 'encouragement', 'replacement', 'management', 'engagement', 'amusement', 'amazement', 'excitement', 'retirement', 'requirement', 'fulfillment'],
    'ust2': ['lost', 'cost', 'crossed', 'tossed', 'exhaust', 'frost', 'boss', 'cross', 'moss', 'sauce', 'cause', 'pause', 'clause', 'applause', 'because', 'across', 'emboss', 'ross'],
    'ank': ['bank', 'tank', 'blank', 'rank', 'thank', 'frank', 'drank', 'sank', 'shank', 'plank', 'crank', 'prank', 'yank', 'spank', 'clank', 'outrank', 'riverbank', 'sandbank', 'snowbank', 'piggybank', 'fishbank', 'outflank', 'point-blank'],
    'ick': ['pick', 'quick', 'thick', 'trick', 'sick', 'stick', 'brick', 'click', 'flick', 'kick', 'nick', 'tick', 'wick', 'slick', 'chick', 'lick', 'lipstick', 'drumstick', 'candlestick', 'chopstick', 'sidekick', 'seasick', 'homesick', 'lovesick', 'heartsick', 'broomstick'],
    'ip': ['trip', 'ship', 'lip', 'tip', 'grip', 'clip', 'drip', 'flip', 'hip', 'rip', 'skip', 'slip', 'strip', 'whip', 'zip', 'chip', 'dip', 'sip', 'equip', 'friendship', 'relationship', 'leadership', 'membership', 'ownership', 'partnership', 'scholarship', 'fellowship', 'worship', 'hardship', 'championship', 'kinship', 'courtship', 'citizenship', 'craftsmanship', 'sportsmanship'],
    'ink': ['think', 'drink', 'link', 'sink', 'pink', 'brink', 'blink', 'stink', 'wink', 'shrink', 'clink', 'rink', 'mink', 'kink', 'sync', 'instinct', 'distinct', 'extinct'],
    'it': ['hit', 'bit', 'sit', 'fit', 'lit', 'spit', 'split', 'quit', 'wit', 'grit', 'knit', 'kit', 'pit', 'admit', 'commit', 'submit', 'permit', 'spirit', 'benefit', 'limit', 'visit', 'credit', 'habit', 'orbit', 'exhibit', 'prohibit', 'inhabit', 'merit', 'inherit', 'outfit', 'misfit', 'moonlit', 'sunlit', 'starlit', 'pitt'],
    'ot': ['not', 'got', 'hot', 'shot', 'spot', 'lot', 'dot', 'plot', 'knot', 'slot', 'trot', 'forgot', 'robot', 'mascot', 'jackpot', 'hotshot', 'gunshot', 'snapshot', 'bloodshot', 'moonshot', 'longshot', 'slingshot', 'earshot', 'buckshot', 'crackpot', 'melting-pot', 'coffeepot', 'flower-pot', 'polka-dot', 'blind-spot'],
    'op': ['stop', 'drop', 'top', 'pop', 'shop', 'hop', 'crop', 'prop', 'cop', 'chop', 'swap', 'nonstop', 'raindrop', 'teardrop', 'dewdrop', 'backdrop', 'tabletop', 'rooftop', 'mountaintop', 'treetop', 'hilltop', 'laptop', 'desktop', 'workshop', 'bookshop', 'barbershop', 'lollipop', 'gumdrop'],
    'ack': ['back', 'track', 'stack', 'pack', 'black', 'crack', 'rack', 'lack', 'attack', 'exact', 'fact', 'impact', 'intact', 'abstract', 'setback', 'payback', 'kickback', 'throwback', 'comeback', 'feedback', 'flashback', 'drawback', 'playback', 'hijack', 'sidetrack', 'backtrack', 'soundtrack', 'knack', 'hack', 'jack', 'snack', 'smack', 'whack', 'slack', 'clack', 'unpack', 'ransack', 'rucksack', 'backpack', 'flapjack', 'outback', 'paperback', 'quarterback', 'zodiac', 'maniac', 'cardiac', 'almanac'],
    'ag': ['bag', 'tag', 'flag', 'drag', 'brag', 'swag', 'mag', 'lag', 'gag', 'rag', 'wag', 'sag', 'nag', 'zigzag', 'sandbag', 'beanbag', 'dirtbag', 'body-bag', 'hashtag', 'price-tag', 'dog-tag', 'airbag'],
    'ap': ['map', 'trap', 'snap', 'wrap', 'clap', 'gap', 'tap', 'cap', 'nap', 'lap', 'slap', 'strap', 'flap', 'scrap', 'chap', 'rap', 'dap', 'zap', 'overlap', 'mishap', 'kidnap', 'recap', 'kneecap', 'bootstrap', 'mousetrap', 'thunderclap', 'handicap', 'burlap', 'roadmap'],
    'atch': ['catch', 'match', 'watch', 'patch', 'scratch', 'snatch', 'batch', 'hatch', 'latch', 'thatch', 'attach', 'detach', 'dispatch', 'mismatch', 'rematch', 'crosshatch', 'eyepatch', 'doorlatch'],
    'ash': ['crash', 'flash', 'clash', 'splash', 'dash', 'smash', 'trash', 'cash', 'bash', 'lash', 'slash', 'rash', 'hash', 'stash', 'mash', 'gash', 'brash', 'eyelash', 'backlash', 'whiplash', 'mustache', 'panache'],
    'aw': ['saw', 'raw', 'draw', 'law', 'jaw', 'claw', 'flaw', 'straw', 'thaw', 'awe', 'paw', 'slaw', 'withdraw', 'outlaw', 'in-law', 'chainsaw', 'jigsaw', 'seesaw', 'hacksaw', 'coleslaw'],
    'oil': ['soil', 'toil', 'coil', 'foil', 'boil', 'spoil', 'broil', 'loyal', 'royal', 'recoil', 'turmoil', 'uncoil', 'tinfoil', 'topsoil', 'subsoil', 'charbroil', 'embroil', 'gargoyle'],
    'oy': ['boy', 'joy', 'toy', 'enjoy', 'destroy', 'employ', 'deploy', 'annoy', 'decoy', 'convoy', 'cowboy', 'tomboy', 'playboy', 'homeboy', 'loverboy', 'choirboy', 'schoolboy', 'newsboy', 'bellboy', 'killjoy', 'alloy', 'ploy'],
    'ang': ['sang', 'hang', 'bang', 'rang', 'gang', 'slang', 'fang', 'tang', 'twang', 'pang', 'boomerang', 'mustang', 'cliffhang', 'overhang'],
    'ust3': ['just', 'trust', 'dust', 'must', 'rust', 'gust', 'bust', 'crust', 'thrust', 'adjust', 'disgust', 'robust', 'combust', 'wanderlust'],
    'owl': ['foul', 'owl', 'growl', 'howl', 'prowl', 'scowl', 'towel', 'vowel', 'jowl', 'fowl', 'cowl'],
    'awning': ['warning', 'morning', 'dawning', 'yawning', 'spawning', 'fawning', 'scorning', 'mourning', 'adorning'],
    'epping': ['repping', 'stepping', 'prepping', 'peppping'],

    // --- Multi-syllable rhyme families ---
    'ation': ['inspiration', 'motivation', 'elevation', 'celebration', 'devastation', 'fascination', 'imagination', 'liberation', 'meditation', 'revelation', 'sensation', 'vibration', 'creation', 'nation', 'foundation', 'salvation', 'frustration', 'generation', 'hesitation', 'innovation', 'isolation', 'navigation', 'obligation', 'operation', 'preparation', 'radiation', 'separation', 'temptation', 'vacation', 'violation', 'accusation', 'admiration', 'application', 'civilization', 'combination', 'communication', 'concentration', 'conversation', 'declaration', 'dedication', 'destination', 'determination', 'documentation', 'education', 'elimination', 'estimation', 'evaluation', 'exploration', 'fabrication', 'graduation', 'illustration', 'imitation', 'information', 'justification', 'manipulation', 'observation', 'participation', 'population', 'proclamation', 'recommendation', 'representation', 'situation', 'transformation', 'utilization', 'verification', 'station', 'relation', 'adoration', 'constellation', 'congregation', 'contemplation', 'desperation', 'domination', 'fascination', 'sensation', 'devastation', 'frustration', 'illustration', 'ration'],
    'otion': ['emotion', 'devotion', 'motion', 'ocean', 'notion', 'potion', 'promotion', 'commotion', 'locomotion', 'demotion'],
    'assion': ['passion', 'fashion', 'compassion', 'assassin'],
    'ision': ['vision', 'precision', 'decision', 'division', 'collision', 'provision', 'revision', 'television', 'supervision', 'incision', 'derision', 'envision', 'ambition', 'condition', 'competition', 'composition', 'definition', 'demolition', 'disposition', 'edition', 'exhibition', 'expedition', 'ignition', 'inhibition', 'intuition', 'mission', 'ammunition', 'nutrition', 'opposition', 'partition', 'petition', 'position', 'recognition', 'repetition', 'superstition', 'tradition', 'transition', 'transmission', 'permission', 'admission', 'submission', 'commission', 'emission', 'omission', 'remission', 'acquisition', 'inquisition', 'proposition', 'premonition', 'prohibition', 'admonition', 'attrition', 'contrition', 'fruition', 'rendition', 'sedition', 'perdition', 'requisition', 'benediction', 'jurisdiction', 'prediction', 'conviction', 'eviction', 'restriction', 'addiction', 'affliction', 'fiction', 'friction', 'diction', 'contradiction'],
    'usion': ['confusion', 'illusion', 'conclusion', 'delusion', 'exclusion', 'inclusion', 'intrusion', 'seclusion', 'fusion', 'infusion', 'transfusion', 'diffusion', 'explosion', 'erosion', 'corrosion', 'revolution', 'evolution', 'resolution', 'dissolution', 'absolution', 'pollution', 'solution', 'institution', 'constitution', 'substitution', 'prosecution', 'persecution', 'execution'],
    'ession': ['obsession', 'expression', 'impression', 'possession', 'depression', 'aggression', 'confession', 'compression', 'concession', 'discretion', 'digression', 'oppression', 'profession', 'progression', 'regression', 'succession', 'suppression', 'transgression'],
    // 'ition' merged into 'ision' above (vision/position/mission/ambition all rhyme)
    'ity': ['gravity', 'sanity', 'clarity', 'reality', 'serenity', 'eternity', 'infinity', 'electricity', 'velocity', 'prosperity', 'adversity', 'capacity', 'identity', 'intensity', 'opportunity', 'possibility', 'creativity', 'dignity', 'divinity', 'humanity', 'insanity', 'majesty', 'necessity', 'priority', 'quality', 'security', 'simplicity', 'sincerity', 'solidarity', 'tranquility', 'university', 'vivacity', 'brutality', 'complexity', 'curiosity', 'equality', 'fatality', 'generosity', 'hostility', 'immortality', 'integrity', 'mentality', 'morality', 'nobility', 'originality', 'personality', 'publicity', 'sensitivity', 'spirituality', 'visibility', 'city', 'pity'],
    'ence': ['experience', 'consequence', 'confidence', 'evidence', 'excellence', 'influence', 'innocence', 'patience', 'presence', 'reference', 'sequence', 'silence', 'violence', 'defense', 'intense', 'suspense', 'immense', 'absence', 'audience', 'brilliance', 'circumstance', 'competence', 'conscience', 'correspondence', 'dependence', 'difference', 'diligence', 'dominance', 'elegance', 'emergence', 'endurance', 'existence', 'ignorance', 'importance', 'independence', 'indifference', 'intelligence', 'interference', 'magnificence', 'negligence', 'obedience', 'occurrence', 'persistence', 'preference', 'prominence', 'providence', 'reluctance', 'remembrance', 'resistance', 'significance', 'substance', 'tolerance', 'turbulence', 'vigilance'],
    'ize': ['realize', 'memorize', 'visualize', 'harmonize', 'energize', 'paralyze', 'hypnotize', 'recognize', 'capitalize', 'improvise', 'compromise', 'synchronize', 'fantasize', 'materialize', 'revolutionize', 'apologize', 'authorize', 'categorize', 'characterize', 'customize', 'dramatize', 'economize', 'emphasize', 'exercise', 'fertilize', 'galvanize', 'hospitalize', 'idolize', 'jeopardize', 'legitimize', 'maximize', 'minimize', 'monopolize', 'neutralize', 'normalize', 'optimize', 'organize', 'ostracize', 'patronize', 'penalize', 'polarize', 'prioritize', 'rationalize', 'romanticize', 'scrutinize', 'socialize', 'specialize', 'stabilize', 'summarize', 'symbolize', 'terrorize', 'utilize', 'vandalize', 'vocalize', 'weaponize', 'eyes', 'rise', 'wise', 'size', 'prize', 'lies', 'dies', 'ties', 'cries', 'flies', 'tries', 'skies', 'guys', 'surprise', 'disguise', 'demise', 'advise', 'revise', 'devise', 'despise', 'arise', 'replies', 'supplies', 'denies', 'applies', 'implies', 'allies', 'defies', 'complies', 'highs', 'sighs', 'thighs', 'goodbyes', 'butterflies', 'lullabies', 'paradise', 'otherwise', 'enterprise', 'supervise'],
    'ory': ['memory', 'victory', 'history', 'mystery', 'glory', 'story', 'allegory', 'category', 'territory', 'factory', 'sanctuary', 'documentary', 'exploratory', 'inventory', 'laboratory', 'mandatory', 'migratory', 'obligatory', 'observatory', 'predatory', 'preparatory', 'repository', 'satisfactory', 'statutory', 'trajectory', 'transitory'],
    'ment': ['moment', 'movement', 'excitement', 'achievement', 'environment', 'entertainment', 'abandonment', 'amazement', 'commitment', 'development', 'embodiment', 'establishment', 'fulfillment', 'improvement', 'involvement', 'management', 'replacement', 'requirement', 'settlement', 'statement', 'tournament', 'treatment', 'acknowledgment', 'advancement', 'advertisement', 'agreement', 'announcement', 'apartment', 'arrangement', 'assessment', 'attachment', 'attainment', 'amusement', 'astonishment', 'bewilderment', 'compartment', 'contentment', 'department', 'detachment', 'discouragement', 'displacement', 'employment', 'empowerment', 'enchantment', 'encouragement', 'endorsement', 'engagement', 'enjoyment', 'enlightenment', 'equipment', 'experiment', 'fragment', 'government', 'harassment', 'imprisonment', 'installment', 'instrument', 'investment', 'judgment', 'measurement', 'monument', 'nourishment', 'parliament', 'payment', 'predicament', 'punishment', 'resentment', 'retirement', 'segment', 'supplement', 'temperament'],
    'ful': ['beautiful', 'powerful', 'wonderful', 'meaningful', 'grateful', 'peaceful', 'graceful', 'faithful', 'hopeful', 'sorrowful', 'plentiful', 'bountiful', 'cheerful', 'colorful', 'delightful', 'disdainful', 'distasteful', 'doubtful', 'dreadful', 'eventful', 'fanciful', 'fearful', 'forgetful', 'fruitful', 'gleeful', 'handful', 'harmful', 'hateful', 'hurtful', 'insightful', 'joyful', 'lawful', 'lustful', 'masterful', 'merciful', 'mindful', 'mournful', 'neglectful', 'painful', 'pitiful', 'playful', 'prayerful', 'purposeful', 'regretful', 'remorseful', 'reproachful', 'resentful', 'resourceful', 'respectful', 'revengeful', 'rightful', 'scornful', 'shameful', 'sinful', 'skillful', 'spiteful', 'successful', 'tasteful', 'tearful', 'thankful', 'thoughtful', 'trustful', 'truthful', 'ungrateful', 'unlawful', 'unmerciful', 'untruthful', 'vengeful', 'wasteful', 'watchful', 'willful', 'wishful', 'woeful', 'wrathful', 'wrongful', 'youthful', 'zealous'],
    'ous': ['dangerous', 'glamorous', 'marvelous', 'mysterious', 'generous', 'glorious', 'courageous', 'adventurous', 'miraculous', 'outrageous', 'treacherous', 'luminous', 'infamous', 'fabulous', 'anonymous', 'barbarous', 'boisterous', 'calamitous', 'chivalrous', 'conspicuous', 'continuous', 'copious', 'curious', 'delirious', 'disastrous', 'envious', 'erroneous', 'ferocious', 'frivolous', 'furious', 'gorgeous', 'gratuitous', 'gregarious', 'hazardous', 'hilarious', 'illustrious', 'impervious', 'industrious', 'infectious', 'ingenious', 'laborious', 'libelous', 'malicious', 'monstrous', 'murderous', 'nefarious', 'nervous', 'notorious', 'obnoxious', 'ominous', 'perilous', 'pompous', 'precarious', 'prosperous', 'rapturous', 'ravenous', 'rebellious', 'ridiculous', 'rigorous', 'scandalous', 'scrupulous', 'sensuous', 'serious', 'spontaneous', 'strenuous', 'studious', 'tedious', 'tempestuous', 'thunderous', 'torturous', 'tremendous', 'tumultuous', 'ubiquitous', 'unanimous', 'unconscious', 'unglamorous', 'venomous', 'victorious', 'vigorous', 'villainous', 'virtuous', 'vivacious', 'vociferous', 'voluminous', 'wondrous', 'zealous'],
    'ude': ['attitude', 'gratitude', 'solitude', 'magnitude', 'multitude', 'amplitude', 'aptitude', 'fortitude', 'latitude', 'longitude', 'servitude', 'certitude', 'crude', 'dude', 'food', 'mood', 'rude', 'brood', 'conclude', 'exclude', 'include', 'intrude', 'preclude', 'protrude', 'seclude'],

    // --- Celebrity punchline rhyme families ---
    'ock': ['rock', 'block', 'clock', 'knock', 'lock', 'shock', 'stock', 'mock', 'dock', 'flock', 'sock', 'unlock', 'deadlock', 'gridlock', 'padlock', 'shamrock', 'bedrock', 'livestock', 'woodstock', 'aftershock', 'pac'],
    'ool': ['cool', 'fool', 'pool', 'school', 'tool', 'jewel', 'fuel', 'cruel', 'dual', 'duel', 'rule', 'stool', 'drool', 'spool', 'whirlpool', 'carpool', 'preschool', 'overrule', 'ridicule', 'molecule', 'minuscule'],
    'action': ['action', 'traction', 'fraction', 'satisfaction', 'reaction', 'attraction', 'distraction', 'interaction', 'extraction', 'transaction', 'infraction', 'compaction', 'abstraction', 'contraction', 'jackson'],
    'ing': ['king', 'ring', 'thing', 'bring', 'swing', 'bling', 'string', 'sing', 'spring', 'fling', 'wing', 'cling', 'sting', 'sling', 'wring', 'everything', 'anything', 'something', 'nothing'],
    'een': ['mean', 'clean', 'scene', 'screen', 'machine', 'keen', 'between', 'serene', 'magazine', 'routine', 'supreme', 'intervene', 'gasoline', 'trampoline', 'figurine', 'tangerine', 'submarine', 'quarantine', 'limousine', 'evergreen', 'unforeseen', 'wolverine', 'halloween', 'mezzanine', 'dean', 'jean', 'sheen'],
    'an': ['man', 'plan', 'can', 'fan', 'ran', 'clan', 'span', 'ban', 'began', 'sedan', 'caravan', 'understand', 'demand', 'command', 'expand', 'contraband', 'overran', 'superman', 'batman', 'spiderman', 'stan', 'chan'],
    'ill': ['will', 'kill', 'skill', 'still', 'fill', 'thrill', 'chill', 'drill', 'grill', 'hill', 'mill', 'pill', 'spill', 'until', 'fulfill', 'goodwill', 'overkill', 'uphill', 'instill', 'distill', 'windmill', 'downhill', 'standstill', 'treadmill'],
    'ames': ['james', 'games', 'flames', 'names', 'claims', 'frames', 'aims', 'shames', 'blames', 'proclaims', 'exclaims'],
    'oose': ['loose', 'goose', 'juice', 'truce', 'produce', 'reduce', 'introduce', 'seduce', 'excuse', 'deduce', 'spruce', 'caboose', 'recluse', 'cruise'],
    'em': ['them', 'gem', 'stem', 'hem', 'condemn', 'requiem', 'stratagem', 'diadem', 'anthem', 'problem', 'system', 'rhythm', 'eminem'],
    'oop': ['loop', 'group', 'scoop', 'troop', 'stoop', 'swoop', 'hoop', 'droop', 'coop', 'recoup', 'regroup', 'snoop'],
    'ast': ['last', 'fast', 'past', 'blast', 'cast', 'vast', 'contrast', 'forecast', 'broadcast', 'outcast', 'steadfast', 'overcast', 'downcast', 'outlast', 'typecast', 'aghast'],
    'ex': ['flex', 'next', 'hex', 'text', 'complex', 'apex', 'index', 'reflex', 'annex', 'perplex', 'duplex', 'latex', 'specs', 'checks', 'decks', 'wrecks', 'effects', 'respects', 'reflects', 'connects', 'protects', 'dmx'],
    'iller': ['killer', 'thriller', 'filler', 'pillar', 'gorilla', 'vanilla', 'chinchilla', 'guerrilla', 'caterpillar', 'distiller', 'painkiller'],
    'arker': ['darker', 'marker', 'parker', 'barker', 'starker', 'sharker', 'embarker', 'remarker'],

    // --- Past tense / -ated rhyme families ---
    'ated': ['appreciated', 'alleviated', 'elevated', 'incarcerated', 'celebrated', 'dominated', 'devastated', 'fascinated', 'hesitated', 'illuminated', 'investigated', 'manipulated', 'navigated', 'obliterated', 'radiated', 'separated', 'tolerated', 'gravitated', 'motivated', 'captivated', 'activated', 'demonstrated', 'elaborated', 'eliminated', 'generated', 'liberated', 'meditated', 'orchestrated', 'participated', 'translated', 'created', 'hated', 'dated', 'rated', 'escalated', 'accumulated', 'accommodated', 'anticipated', 'communicated', 'concentrated', 'cooperated', 'decorated', 'educated', 'evaluated', 'exaggerated', 'fabricated', 'graduated', 'illustrated', 'incorporated', 'integrated', 'irritated', 'negotiated', 'operated', 'penetrated', 'regulated', 'simulated', 'terminated', 'violated', 'intoxicated', 'mesmerized', 'complicated', 'dedicated', 'annihilated', 'decimated', 'suffocated', 'contaminated', 'exterminated', 'infatuated', 'underestimated', 'overrated', 'underrated', 'isolated', 'frustrated', 'liberated', 'cremated', 'sedated', 'related', 'located', 'inflated', 'debated'],
    'ized': ['realized', 'memorized', 'visualized', 'harmonized', 'energized', 'paralyzed', 'hypnotized', 'recognized', 'capitalized', 'improvised', 'compromised', 'synchronized', 'fantasized', 'materialized', 'revolutionized', 'apologized', 'authorized', 'categorized', 'characterized', 'customized', 'dramatized', 'economized', 'emphasized', 'exercised', 'galvanized', 'hospitalized', 'idolized', 'jeopardized', 'legitimized', 'maximized', 'minimized', 'monopolized', 'neutralized', 'normalized', 'optimized', 'organized', 'ostracized', 'patronized', 'penalized', 'polarized', 'prioritized', 'rationalized', 'romanticized', 'scrutinized', 'socialized', 'specialized', 'stabilized', 'summarized', 'symbolized', 'terrorized', 'utilized', 'vandalized', 'vocalized', 'weaponized', 'mesmerized', 'traumatized', 'baptized', 'criticized', 'advertised', 'supervised', 'surprised'],
    'oken': ['broken', 'spoken', 'woken', 'unbroken', 'outspoken', 'softspoken', 'token', 'awoken'],
    'iven': ['driven', 'given', 'forgiven', 'forbidden', 'hidden', 'ridden', 'unforgiven', 'overdriven'],
    'otten': ['forgotten', 'rotten', 'gotten', 'begotten', 'misbegotten', 'downtrodden'],
    'anded': ['demanded', 'commanded', 'expanded', 'branded', 'stranded', 'abandoned', 'disbanded', 'handed', 'landed', 'reprimanded', 'surrendered', 'withstanded'],
    'ended': ['defended', 'offended', 'pretended', 'suspended', 'descended', 'surrendered', 'extended', 'recommended', 'transcended', 'blended', 'mended', 'apprehended', 'comprehended'],
    'ected': ['connected', 'protected', 'respected', 'reflected', 'rejected', 'collected', 'directed', 'expected', 'neglected', 'perfected', 'resurrected', 'selected', 'subjected', 'suspected', 'affected', 'corrected', 'deflected', 'detected', 'dissected', 'elected', 'infected', 'injected', 'inspected', 'objected', 'projected', 'redirected', 'resected', 'undetected', 'unexpected', 'disrespected', 'disconnected', 'misdirected'],
    'pted': ['accepted', 'corrupted', 'disrupted', 'erupted', 'interrupted', 'adapted', 'adopted', 'encrypted', 'excepted', 'exempted', 'intercepted', 'sculpted', 'attempted', 'prompted'],
    'ured': ['endured', 'matured', 'obscured', 'secured', 'assured', 'captured', 'cultured', 'featured', 'fractured', 'manufactured', 'measured', 'nurtured', 'pictured', 'pleasured', 'structured', 'textured', 'tortured', 'treasured', 'ventured'],
    'overed': ['discovered', 'recovered', 'uncovered', 'hovered', 'covered', 'smothered', 'mothered', 'bothered'],
};

// Build reverse lookup: word -> family key
const WORD_TO_FAMILY = {};
for (const [family, words] of Object.entries(RHYME_FAMILIES)) {
    for (const word of words) {
        if (!WORD_TO_FAMILY[word]) WORD_TO_FAMILY[word] = [];
        WORD_TO_FAMILY[word].push(family);
    }
}

// ============================================================================
// LOCALIZED RHYME FAMILIES SUPPORT
// For non-English languages, phrase banks provide language-specific rhyme families.
// ============================================================================

let _localizedRhymeFamilies = null;
let _localizedWordToFamily = null;

/**
 * Set localized rhyme families for the current generation language.
 * Called by PhraseLoader when language changes.
 * @param {object|null} families - { familyKey: [word1, word2, ...] } or null for English
 */
export function setLocalizedRhymeFamilies(families) {
    _localizedRhymeFamilies = families;
    if (families && Object.keys(families).length > 0) {
        _localizedWordToFamily = {};
        for (const [family, words] of Object.entries(families)) {
            for (const word of words) {
                if (!_localizedWordToFamily[word]) _localizedWordToFamily[word] = [];
                _localizedWordToFamily[word].push(family);
            }
        }
    } else {
        _localizedWordToFamily = null;
    }
}

/**
 * Get the active rhyme families (localized or English).
 * @returns {object}
 */
export function getActiveRhymeFamilies() {
    return _localizedRhymeFamilies || RHYME_FAMILIES;
}

/**
 * Get the active word-to-family map (localized or English).
 * @returns {object}
 */
export function getActiveWordToFamily() {
    return _localizedWordToFamily || WORD_TO_FAMILY;
}

// ============================================================================
// MULTI-WORD COMPOUND RHYME SUPPORT
// Eminem-style: "cool to be" rhymes with "Woolery", "four-inch doorhinge" with "orange"
// Allows multi-word endings to match single-word rhyme families
// ============================================================================

// Multi-word phrases that phonetically match a rhyme family
// Key: normalized phrase (lowercase, alphanumeric+spaces), Value: family key
const COMPOUND_RHYMES = {
    // ================================================================
    // SUPER MASSIVE COMPOUND RHYME DICTIONARY (500+ entries)
    // Multi-word phrases that phonetically match rhyme families
    // Covers ALL rhyme families in RHYME_FAMILIES
    // ================================================================

    // --- 'ight' family — night, light, fight, right, bright ---
    'out of sight': 'ight', 'hold on tight': 'ight', 'feels so right': 'ight',
    'shining bright': 'ight', 'start a fight': 'ight', 'through the night': 'ight',
    'black and white': 'ight', 'take a bite': 'ight', 'burning light': 'ight',
    'morning light': 'ight', 'second sight': 'ight', 'outta sight': 'ight',
    'do it right': 'ight', 'inner light': 'ight', 'lose the fight': 'ight',
    'dead of night': 'ight', 'at first sight': 'ight', 'guiding light': 'ight',
    'wrong or right': 'ight', 'fading light': 'ight', 'end in sight': 'ight',

    // --- 'ay' family — day, way, say, play, stay ---
    'every day': 'ay', 'all the way': 'ay', 'here to stay': 'ay',
    'led astray': 'ay', 'come what may': 'ay', 'gotta say': 'ay',
    'fly away': 'ay', 'fade away': 'ay', 'run away': 'ay',
    'by the way': 'ay', 'right away': 'ay', 'what they say': 'ay',
    'save the day': 'ay', 'seize the day': 'ay', 'light the way': 'ay',
    'on display': 'ay', 'thrown away': 'ay', 'give away': 'ay',
    'child at play': 'ay', 'pave the way': 'ay', 'clear as day': 'ay',
    'gone astray': 'ay', 'hip hooray': 'ay', 'price to pay': 'ay',

    // --- 'ain' family — rain, pain, chain, brain ---
    'down the lane': 'ain', 'go insane': 'ain', 'feel the pain': 'ain',
    'through the rain': 'ain', 'ball and chain': 'ain', 'fast lane': 'ain',
    'gravy train': 'ain', 'weather vane': 'ain', 'inner flame': 'ain',
    'use your brain': 'ain', 'blood in vain': 'ain', 'break the chain': 'ain',
    'memory lane': 'ain', 'hard to explain': 'ain', 'on the train': 'ain',
    'leave a stain': 'ain', 'stake a claim': 'ain', 'constant pain': 'ain',

    // --- 'ame' family — fame, game, flame, name ---
    'hall of fame': 'ame', 'run the game': 'ame', 'stake my claim': 'ame',
    'fan the flame': 'ame', 'what a shame': 'ame', 'take the blame': 'ame',
    'in the game': 'ame', 'not the same': 'ame', 'call my name': 'ame',
    'claim to fame': 'ame', 'burning flame': 'ame', 'end the game': 'ame',
    'rise to fame': 'ame', 'gold frame': 'ame', 'know your name': 'ame',

    // --- 'ace' family — face, place, space, grace ---
    'saving grace': 'ace', 'run the race': 'ace', 'poker face': 'ace',
    'outer space': 'ace', 'market place': 'ace', 'common place': 'ace',
    'keep the pace': 'ace', 'fall from grace': 'ace', 'leave no trace': 'ace',
    'hiding place': 'ace', 'about face': 'ace', 'in your face': 'ace',
    'state of grace': 'ace', 'resting place': 'ace', 'pick up pace': 'ace',

    // --- 'ade' family — made, blade, shade, trade ---
    'tailor made': 'ade', 'hit the grade': 'ade', 'lemonade': 'ade',
    'barricade': 'ade', 'masquerade': 'ade', 'escapade': 'ade',
    'custom made': 'ade', 'razor blade': 'ade', 'hand grenade': 'ade',
    'getting paid': 'ade', 'first aid': 'ade', 'foreign trade': 'ade',
    'trick of trade': 'ade', 'plans i laid': 'ade', 'self made': 'ade',
    'hit parade': 'ade', 'in the shade': 'ade', 'debts are paid': 'ade',

    // --- 'ate' family — late, fate, gate, state, great ---
    'twist of fate': 'ate', 'running late': 'ate', 'golden gate': 'ate',
    'love and hate': 'ate', 'set it straight': 'ate', 'carry weight': 'ate',
    'time to wait': 'ate', 'dinner plate': 'ate', 'check the rate': 'ate',
    'empire state': 'ate', 'perfect mate': 'ate', 'clean the slate': 'ate',
    'open gate': 'ate', 'feel the weight': 'ate', 'simply great': 'ate',

    // --- 'ake' family — make, take, break, wake ---
    'on the take': 'ake', 'no mistake': 'ake', 'for the sake': 'ake',
    'wide awake': 'ake', 'earth will quake': 'ake', 'give and take': 'ake',
    'make or break': 'ake', 'piece of cake': 'ake', 'double take': 'ake',
    'in my wake': 'ake', 'pound the stake': 'ake', 'pump the brake': 'ake',
    'body ache': 'ake', 'crystal lake': 'ake', 'what it takes': 'ake',

    // --- 'ale' family — tale, scale, sail, trail ---
    'fairy tale': 'ale', 'holy grail': 'ale', 'epic fail': 'ale',
    'hit the trail': 'ale', 'without fail': 'ale', 'tip the scale': 'ale',
    'beyond the pale': 'ale', 'set the sail': 'ale', 'out on bail': 'ale',
    'off the rail': 'ale', 'tell the tale': 'ale', 'paper trail': 'ale',
    'snail mail': 'ale', 'hammer nail': 'ale', 'slippery trail': 'ale',

    // --- 'ee' family — free, me, see, key ---
    'set me free': 'ee', 'let it be': 'ee', 'meant to be': 'ee',
    'got to be': 'ee', 'want to be': 'ee', 'follow me': 'ee',
    'ride with me': 'ee', 'come with me': 'ee', 'can you see': 'ee',
    'hard to see': 'ee', 'what i see': 'ee', 'wait and see': 'ee',
    'just like me': 'ee', 'enemy': 'ee', 'energy': 'ee',
    'inner peace': 'ee', 'masterpiece': 'ee', 'got the key': 'ee',
    'guarantee': 'ee', 'used to be': 'ee', 'recipe': 'ee',
    'have to be': 'ee', 'so carefree': 'ee', 'disagree': 'ee',
    'refugee': 'ee', 'hold the key': 'ee', 'let me be': 'ee',

    // --- 'eal' family — feel, real, deal, heal ---
    'no big deal': 'eal', 'sex appeal': 'eal', 'how i feel': 'eal',
    'achilles heel': 'eal', 'make it real': 'eal', 'spin the wheel': 'eal',
    'keep it real': 'eal', 'raw deal': 'eal', 'heart of steel': 'eal',
    'lets make a deal': 'eal', 'power to heal': 'eal', 'broken seal': 'eal',
    'begin to feel': 'eal', 'steering wheel': 'eal', 'time will heal': 'eal',
    'big reveal': 'eal', 'what is real': 'eal', 'nerves of steel': 'eal',

    // --- 'eat' family — beat, heat, street, sweet ---
    'feel the heat': 'eat', 'dead meat': 'eat', 'cant compete': 'eat',
    'on the street': 'eat', 'accept defeat': 'eat', 'heart will beat': 'eat',
    'drum will beat': 'eat', 'bittersweet': 'eat', 'concrete street': 'eat',
    'move your feet': 'eat', 'trick or treat': 'eat', 'take a seat': 'eat',
    'hard to beat': 'eat', 'mission complete': 'eat', 'skip a beat': 'eat',

    // --- 'eed' family — need, bleed, speed, feed ---
    'all i need': 'eed', 'let it bleed': 'eed', 'need for speed': 'eed',
    'good indeed': 'eed', 'planted seed': 'eed', 'time to feed': 'eed',
    'hearts that bleed': 'eed', 'will succeed': 'eed', 'take the lead': 'eed',
    'do the deed': 'eed', 'have to heed': 'eed', 'born to lead': 'eed',
    'mouth to feed': 'eed', 'pay no heed': 'eed', 'selfish greed': 'eed',

    // --- 'eam' family — dream, team, stream ---
    'living dream': 'eam', 'self esteem': 'eam', 'ice cream': 'eam',
    'mainstream': 'eam', 'on the team': 'eam', 'laser beam': 'eam',
    'winning team': 'eam', 'pipe dream': 'eam', 'extreme': 'eam',
    'chase the dream': 'eam', 'hear me scream': 'eam', 'burst the seam': 'eam',
    'silver stream': 'eam', 'grand scheme': 'eam', 'build the team': 'eam',

    // --- 'ear' family — hear, fear, near, clear ---
    'crystal clear': 'ear', 'nothing to fear': 'ear', 'far and near': 'ear',
    'loud and clear': 'ear', 'shed a tear': 'ear', 'lend an ear': 'ear',
    'coast is clear': 'ear', 'pioneer': 'ear', 'volunteer': 'ear',
    'end is near': 'ear', 'disappear': 'ear', 'hold me near': 'ear',
    'atmosphere': 'ear', 'souvenir': 'ear', 'engineer': 'ear',

    // --- 'ess' family — less, bless, stress, express ---
    'nothing less': 'ess', 'under stress': 'ess', 'what a mess': 'ess',
    'must confess': 'ess', 'second guess': 'ess', 'nonetheless': 'ess',
    'more or less': 'ess', 'power chess': 'ess', 'full access': 'ess',
    'battle dress': 'ess', 'to impress': 'ess', 'couldnt care less': 'ess',
    'in excess': 'ess', 'work in progress': 'ess', 'acquiesce': 'ess',

    // --- 'est' family — best, rest, test, chest ---
    'above the rest': 'est', 'never rest': 'est', 'bullet vest': 'est',
    'treasure chest': 'est', 'put to test': 'est', 'very best': 'est',
    'second best': 'est', 'eagle nest': 'est', 'fully dressed': 'est',
    'laid to rest': 'est', 'at my best': 'est', 'heading west': 'est',
    'special guest': 'est', 'failed the test': 'est', 'manifest': 'est',
    'be my guest': 'est', 'i suggest': 'est', 'heavy chest': 'est',

    // --- 'ell' family — tell, well, hell, spell ---
    'cast a spell': 'ell', 'show and tell': 'ell', 'wish you well': 'ell',
    'tales to tell': 'ell', 'heaven or hell': 'ell', 'never fell': 'ell',
    'buy and sell': 'ell', 'prison cell': 'ell', 'wishing well': 'ell',
    'hard to tell': 'ell', 'know it well': 'ell', 'ring the bell': 'ell',
    'what the hell': 'ell', 'straight from hell': 'ell', 'time will tell': 'ell',
    'saved by the bell': 'ell', 'depths of hell': 'ell', 'living hell': 'ell',

    // --- 'end' family — end, friend, send, defend ---
    'bitter end': 'end', 'on the mend': 'end', 'round the bend': 'end',
    'best of friend': 'end', 'newest trend': 'end', 'money lend': 'end',
    'start to end': 'end', 'until the end': 'end', 'make amend': 'end',
    'dead end': 'end', 'loose end': 'end', 'godsend': 'end',
    'will defend': 'end', 'rules i bend': 'end', 'heart to mend': 'end',

    // --- 'ine' family — mine, shine, line, sign ---
    'bottom line': 'ine', 'that is mine': 'ine', 'rain or shine': 'ine',
    'cross the line': 'ine', 'dollar sign': 'ine', 'aged like wine': 'ine',
    'draw the line': 'ine', 'neon sign': 'ine', 'hold the line': 'ine',
    'by design': 'ine', 'feel so fine': 'ine', 'toe the line': 'ine',
    'warning sign': 'ine', 'down the line': 'ine', 'born to shine': 'ine',

    // --- 'ide' family — ride, side, hide, pride ---
    'along the ride': 'ide', 'take in stride': 'ide', 'flip the tide': 'ide',
    'swallow pride': 'ide', 'open wide': 'ide', 'step aside': 'ide',
    'other side': 'ide', 'dark side': 'ide', 'cant decide': 'ide',
    'nowhere to hide': 'ide', 'run and hide': 'ide', 'deep inside': 'ide',
    'by my side': 'ide', 'let it slide': 'ide', 'nationwide': 'ide',
    'bonnie and clyde': 'ide', 'smooth ride': 'ide', 'suicide ride': 'ide',

    // --- 'ire' family — fire, desire, higher, inspire ---
    'catching fire': 'ire', 'never tire': 'ire', 'raise it higher': 'ire',
    'hearts desire': 'ire', 'funeral pyre': 'ire', 'under fire': 'ire',
    'open fire': 'ire', 'friendly fire': 'ire', 'walking wire': 'ire',
    'set on fire': 'ire', 'burning desire': 'ire', 'aim much higher': 'ire',
    'cross the wire': 'ire', 'worlds on fire': 'ire', 'whole empire': 'ire',
    'rapid fire': 'ire', 'hell and fire': 'ire', 'ring of fire': 'ire',

    // --- 'ive' family — alive, drive, survive, thrive ---
    'stay alive': 'ive', 'hard to survive': 'ive', 'born to thrive': 'ive',
    'test drive': 'ive', 'deep dive': 'ive', 'power drive': 'ive',
    'will survive': 'ive', 'high five': 'ive', 'overdrive': 'ive',
    'dead or alive': 'ive', 'nine to five': 'ive', 'learn to drive': 'ive',
    'barely alive': 'ive', 'start to thrive': 'ive', 'take a dive': 'ive',

    // --- 'ime' family — time, rhyme, climb, crime ---
    'every time': 'ime', 'waste of time': 'ime', 'partner crime': 'ime',
    'perfect rhyme': 'ime', 'uphill climb': 'ime', 'just in time': 'ime',
    'one more time': 'ime', 'doing time': 'ime', 'nickels and dime': 'ime',
    'all the time': 'ime', 'end of time': 'ime', 'scene of crime': 'ime',
    'race with time': 'ime', 'in my prime': 'ime', 'crunch time': 'ime',

    // --- 'ind' family — mind, find, kind, blind ---
    'peace of mind': 'ind', 'left behind': 'ind', 'one of a kind': 'ind',
    'hard to find': 'ind', 'blow my mind': 'ind', 'color blind': 'ind',
    'heart and mind': 'ind', 'daily grind': 'ind', 'speaking mind': 'ind',
    'seek and find': 'ind', 'humankind': 'ind', 'strong and kind': 'ind',
    'losing mind': 'ind', 'never mind': 'ind', 'free my mind': 'ind',

    // --- 'ow' family — know, go, show, flow ---
    'steal the show': 'ow', 'let it go': 'ow', 'friend or foe': 'ow',
    'down below': 'ow', 'high and low': 'ow', 'ebb and flow': 'ow',
    'status quo': 'ow', 'quid pro quo': 'ow', 'afterglow': 'ow',
    'way to go': 'ow', 'watch it grow': 'ow', 'take it slow': 'ow',
    'overflow': 'ow', 'long time ago': 'ow', 'cash to blow': 'ow',

    // --- 'old' family — gold, hold, told, bold ---
    'heart of gold': 'old', 'truth be told': 'old', 'left out cold': 'old',
    'getting old': 'old', 'story told': 'old', 'break the mold': 'old',
    'solid gold': 'old', 'be so bold': 'old', 'stranglehold': 'old',
    'bought and sold': 'old', 'manifold': 'old', 'taking hold': 'old',
    'pot of gold': 'old', 'losing hold': 'old', 'stone cold': 'old',

    // --- 'one' family — alone, phone, bone, stone ---
    'on my own': 'one', 'to the bone': 'one', 'all alone': 'one',
    'overthrown': 'one', 'fully grown': 'one', 'stepping stone': 'one',
    'skin and bone': 'one', 'heart of stone': 'one', 'danger zone': 'one',
    'microphone': 'one', 'monotone': 'one', 'ring the phone': 'one',
    'stand alone': 'one', 'left alone': 'one', 'set the tone': 'one',
    'seeds i sown': 'one', 'flesh and bone': 'one', 'rolling stone': 'one',

    // --- 'ose' family — close, rose, chose, those ---
    'curtain close': 'ose', 'heaven knows': 'ose', 'on my toes': 'ose',
    'anything goes': 'ose', 'decompose': 'ose', 'diagnose': 'ose',
    'strike a pose': 'ose', 'case is closed': 'ose', 'eyes are closed': 'ose',
    'as it goes': 'ose', 'friends and foes': 'ose', 'come to blows': 'ose',
    'way it goes': 'ose', 'highs and lows': 'ose', 'on your toes': 'ose',

    // --- 'ore' family — more, before, floor, door ---
    'nothing more': 'ore', 'to the core': 'ore', 'open door': 'ore',
    'settle the score': 'ore', 'even the score': 'ore', 'ask for more': 'ore',
    'what in store': 'ore', 'ready for war': 'ore', 'ocean floor': 'ore',
    'revolving door': 'ore', 'less is more': 'ore', 'gone before': 'ore',
    'thirst for more': 'ore', 'furthermore': 'ore', 'dance floor': 'ore',
    'never before': 'ore', 'forevermore': 'ore', 'even the score': 'ore',

    // --- 'ong' family — song, strong, long, wrong ---
    'sing a song': 'ong', 'come along': 'ong', 'all day long': 'ong',
    'going strong': 'ong', 'right from wrong': 'ong', 'play along': 'ong',
    'move along': 'ong', 'tag along': 'ong', 'proving wrong': 'ong',
    'all along': 'ong', 'string along': 'ong', 'carry on strong': 'ong',

    // --- 'ound' family — sound, ground, found, round ---
    'lost and found': 'ound', 'common ground': 'ound', 'hear the sound': 'ound',
    'run aground': 'ound', 'gather round': 'ound', 'underground': 'ound',
    'safe and sound': 'ound', 'hold your ground': 'ound', 'merry go round': 'ound',
    'stand your ground': 'ound', 'dollar pound': 'ound', 'hunting ground': 'ound',
    'breaking ground': 'ound', 'spellbound': 'ound', 'duty bound': 'ound',

    // --- 'ose2' family — ghost, most, post, coast ---
    'from coast to coast': 'ose2', 'at the most': 'ose2', 'give a toast': 'ose2',
    'lamp post': 'ose2', 'holy ghost': 'ose2', 'first and foremost': 'ose2',
    'corner post': 'ose2', 'riding the coast': 'ose2', 'proud to boast': 'ose2',

    // --- 'orn' family — born, torn, storm, form ---
    'battle worn': 'orn', 'crack of dawn': 'orn', 'freshly born': 'orn',
    'heart was torn': 'orn', 'weather storm': 'orn', 'perfect form': 'orn',
    'golden horn': 'orn', 'crown of thorn': 'orn', 'newly born': 'orn',
    'eye of storm': 'orn', 'true to form': 'orn', 'brainstorm': 'orn',

    // --- 'ope' family — hope, rope, scope, cope ---
    'ray of hope': 'ope', 'cant cope': 'ope', 'on the ropes': 'ope',
    'false hope': 'ope', 'downward slope': 'ope', 'learn to cope': 'ope',
    'slippery slope': 'ope', 'end of rope': 'ope', 'beyond the scope': 'ope',
    'give up hope': 'ope', 'telescope': 'ope', 'horoscope': 'ope',

    // --- 'ue' family — true, blue, new, through ---
    'tried and true': 'ue', 'coming through': 'ue', 'point of view': 'ue',
    'something new': 'ue', 'ocean blue': 'ue', 'born anew': 'ue',
    'start anew': 'ue', 'follow through': 'ue', 'see it through': 'ue',
    'black and blue': 'ue', 'got a clue': 'ue', 'breaking through': 'ue',
    'revenue': 'ue', 'overdue': 'ue', 'interview': 'ue',

    // --- 'ust' family — trust, dust, must, just ---
    'bite the dust': 'ust', 'in god we trust': 'ust', 'wanderlust': 'ust',
    'gather dust': 'ust', 'upper crust': 'ust', 'total disgust': 'ust',
    'earn the trust': 'ust', 'do or bust': 'ust', 'gold to dust': 'ust',
    'fair and just': 'ust', 'built on trust': 'ust', 'turn to dust': 'ust',
    'boom or bust': 'ust', 'losing trust': 'ust', 'readjust': 'ust',

    // --- 'urn' family — burn, turn, learn, return ---
    'crash and burn': 'urn', 'live and learn': 'urn', 'wait your turn': 'urn',
    'point of no return': 'urn', 'twist and turn': 'urn', 'stomach churn': 'urn',
    'lesson learned': 'urn', 'bridges burned': 'urn', 'tables turned': 'urn',
    'tides have turned': 'urn', 'money earned': 'urn', 'never learn': 'urn',

    // --- 'ull' family — full, pull, beautiful, powerful ---
    'push and pull': 'ull', 'wonderful': 'ull', 'beautiful': 'ull',
    'powerful': 'ull', 'handful': 'ull', 'meaningful': 'ull',
    'plentiful': 'ull', 'bountiful': 'ull', 'pocketful': 'ull',
    'cup is full': 'ull', 'charging bull': 'ull', 'raging bull': 'ull',

    // --- 'uck' family — luck, stuck, truck ---
    'run amuck': 'uck', 'out of luck': 'uck', 'sitting duck': 'uck',
    'passing buck': 'uck', 'dumb luck': 'uck', 'get unstuck': 'uck',
    'thunderstruck': 'uck', 'starstruck': 'uck', 'down on luck': 'uck',
    'push and tuck': 'uck', 'press your luck': 'uck', 'ice cold truck': 'uck',

    // --- 'ung' family — young, tongue, hung ---
    'die young': 'ung', 'sharp tongue': 'ung', 'forever young': 'ung',
    'mother tongue': 'ung', 'hold your tongue': 'ung', 'iron lung': 'ung',
    'bottom rung': 'ung', 'songs i sung': 'ung', 'highly strung': 'ung',

    // --- 'un' family — sun, run, fun, gun ---
    'hit and run': 'un', 'number one': 'un', 'smoking gun': 'un',
    'on the run': 'un', 'just begun': 'un', 'having fun': 'un',
    'setting sun': 'un', 'one by one': 'un', 'under the gun': 'un',
    'said and done': 'un', 'damage done': 'un', 'second to none': 'un',
    'rising sun': 'un', 'jump the gun': 'un', 'battle won': 'un',
    'all or none': 'un', 'overrun': 'un', 'not yet done': 'un',

    // --- 'ar' family — star, far, car, bar ---
    'raise the bar': 'ar', 'from afar': 'ar', 'cinema star': 'ar',
    'fast car': 'ar', 'shooting star': 'ar', 'battle scar': 'ar',
    'gone too far': 'ar', 'who you are': 'ar', 'at the bar': 'ar',
    'rising star': 'ar', 'rock star': 'ar', 'behind bars': 'ar',
    'north star': 'ar', 'open jar': 'ar', 'what you are': 'ar',
    'wishing on a star': 'ar', 'above par': 'ar', 'below par': 'ar',

    // --- 'ass' family — glass, pass, class, fast ---
    'looking glass': 'ass', 'upper class': 'ass', 'first class': 'ass',
    'holding fast': 'ass', 'not gonna last': 'ass', 'running past': 'ass',
    'world class': 'ass', 'hard and fast': 'ass', 'breaking glass': 'ass',
    'come to pass': 'ass', 'standing fast': 'ass', 'growing grass': 'ass',
    'unsurpassed': 'ass', 'lower class': 'ass', 'kick some ass': 'ass',

    // --- 'aze' family — haze, gaze, blaze, maze, phase ---
    'purple haze': 'aze', 'set ablaze': 'aze', 'lost in a maze': 'aze',
    'new phase': 'aze', 'sing my praise': 'aze', 'cloudy haze': 'aze',
    'glory days': 'aze', 'better days': 'aze', 'golden days': 'aze',
    'in a daze': 'aze', 'end of days': 'aze', 'final phase': 'aze',
    'set the blaze': 'aze', 'through the haze': 'aze', 'school days': 'aze',

    // --- 'out' family — out, about, shout, doubt ---
    'inside out': 'out', 'turn about': 'out', 'scream and shout': 'out',
    'beyond a doubt': 'out', 'down and out': 'out', 'lights are out': 'out',
    'knock you out': 'out', 'figure it out': 'out', 'time runs out': 'out',
    'without a doubt': 'out', 'odd man out': 'out', 'working out': 'out',
    'check it out': 'out', 'way out': 'out', 'all about': 'out',

    // --- 'ove' family — love, above, dove, shove ---
    'push and shove': 'ove', 'power of love': 'ove', 'rise above': 'ove',
    'falling in love': 'ove', 'gift of love': 'ove', 'from above': 'ove',
    'thinking of': 'ove', 'tired of': 'ove', 'hand in glove': 'ove',
    'stars above': 'ove', 'dreaming of': 'ove', 'heaven above': 'ove',
    'song of love': 'ove', 'sick of love': 'ove', 'light above': 'ove',

    // --- 'uff' family — enough, tough, rough, stuff ---
    'thats enough': 'uff', 'call my bluff': 'uff', 'diamond rough': 'uff',
    'hot stuff': 'uff', 'right stuff': 'uff', 'getting tough': 'uff',
    'play it rough': 'uff', 'up to snuff': 'uff', 'tough enough': 'uff',

    // --- 'all' family — fall, call, wall, tall ---
    'rise and fall': 'all', 'above it all': 'all', 'standing tall': 'all',
    'after all': 'all', 'wrecking ball': 'all', 'off the wall': 'all',
    'free for all': 'all', 'through it all': 'all', 'having a ball': 'all',
    'beck and call': 'all', 'backs the wall': 'all', 'cannon ball': 'all',
    'end it all': 'all', 'protocol': 'all', 'alcohol': 'all',

    // --- 'art' family — heart, start, smart, part ---
    'from the start': 'art', 'fall apart': 'art', 'broken heart': 'art',
    'work of art': 'art', 'play the part': 'art', 'fresh new start': 'art',
    'change of heart': 'art', 'state of art': 'art', 'worlds apart': 'art',
    'from the heart': 'art', 'playing smart': 'art', 'set apart': 'art',
    'tearing apart': 'art', 'heavy heart': 'art', 'shopping cart': 'art',

    // --- 'ark' family — dark, spark, mark, park ---
    'in the dark': 'ark', 'leave a mark': 'ark', 'hit the mark': 'ark',
    'central park': 'ark', 'light the spark': 'ark', 'question mark': 'ark',
    'shot in dark': 'ark', 'after dark': 'ark', 'off the mark': 'ark',
    'noahs ark': 'ark', 'loan shark': 'ark', 'left a mark': 'ark',

    // --- 'ork' family — work, network, framework ---
    'hard at work': 'ork', 'dirty work': 'ork', 'piece of work': 'ork',
    'make it work': 'ork', 'teamwork': 'ork', 'clockwork': 'ork',
    'new york': 'ork', 'knife and fork': 'ork', 'handiwork': 'ork',

    // --- 'and' family — hand, stand, land, grand ---
    'lend a hand': 'and', 'take a stand': 'and', 'promise land': 'and',
    'helping hand': 'and', 'understand': 'and', 'upper hand': 'and',
    'final stand': 'and', 'foreign land': 'and', 'one man band': 'and',
    'close at hand': 'and', 'high demand': 'and', 'rubber band': 'and',
    'grain of sand': 'and', 'shifting sand': 'and', 'master plan': 'and',

    // --- 'own' family — down, town, crown, brown ---
    'upside down': 'own', 'hold it down': 'own', 'run the town': 'own',
    'never frown': 'own', 'breaking down': 'own', 'shut it down': 'own',
    'lock it down': 'own', 'burning down': 'own', 'falling down': 'own',
    'take the crown': 'own', 'wear the crown': 'own', 'going down': 'own',
    'paint the town': 'own', 'tumbling down': 'own', 'crashing down': 'own',
    'tearing down': 'own', 'golden crown': 'own', 'all around town': 'own',

    // --- 'eep' family — deep, keep, sleep, sweep ---
    'secrets keep': 'eep', 'skin deep': 'eep', 'fast asleep': 'eep',
    'losing sleep': 'eep', 'in too deep': 'eep', 'make you weep': 'eep',
    'souls to reap': 'eep', 'running deep': 'eep', 'cant sleep': 'eep',
    'promise keep': 'eep', 'watch me creep': 'eep', 'six feet deep': 'eep',
    'clean sweep': 'eep', 'counting sheep': 'eep', 'growing steep': 'eep',

    // --- 'oul' family — soul, whole, role, control ---
    'rock and roll': 'oul', 'heart and soul': 'oul', 'self control': 'oul',
    'on a roll': 'oul', 'take control': 'oul', 'pay the toll': 'oul',
    'honor roll': 'oul', 'flag pole': 'oul', 'rabbit hole': 'oul',
    'lose control': 'oul', 'leading role': 'oul', 'body and soul': 'oul',
    'rock n roll': 'oul', 'black hole': 'oul', 'loophole': 'oul',
    'starring role': 'oul', 'drum roll': 'oul', 'on parole': 'oul',

    // --- 'ness' family — darkness, weakness, kindness ---
    'heart of darkness': 'ness', 'show some kindness': 'ness',
    'inner madness': 'ness', 'pure sadness': 'ness', 'quiet stillness': 'ness',
    'total fitness': 'ness', 'mental illness': 'ness', 'sheer boldness': 'ness',
    'perfect goodness': 'ness', 'gentle sweetness': 'ness', 'true greatness': 'ness',

    // --- 'eak' family — break, speak, weak, peak ---
    'winning streak': 'eak', 'so to speak': 'eak', 'hide and seek': 'eak',
    'turn the cheek': 'eak', 'spring a leak': 'eak', 'at the peak': 'eak',
    'strong or weak': 'eak', 'voices speak': 'eak', 'mountain peak': 'eak',
    'sneak a peek': 'eak', 'losing streak': 'eak', 'tongue in cheek': 'eak',

    // --- 'ent' family — sent, went, spent, meant ---
    'what i meant': 'ent', 'heaven sent': 'ent', 'hundred percent': 'ent',
    'came and went': 'ent', 'money spent': 'ent', 'time well spent': 'ent',
    'pitch a tent': 'ent', 'pay the rent': 'ent', 'good intent': 'ent',
    'represent': 'ent', 'making a dent': 'ent', 'malcontent': 'ent',
    'to the extent': 'ent', 'hearts content': 'ent', 'time i spent': 'ent',

    // --- 'ank' family — bank, tank, blank, rank ---
    'draw a blank': 'ank', 'walk the plank': 'ank', 'fill the tank': 'ank',
    'break the bank': 'ank', 'point blank': 'ank', 'pull rank': 'ank',
    'to be frank': 'ank', 'piggy bank': 'ank', 'give thanks': 'ank',
    'river bank': 'ank', 'empty tank': 'ank', 'hit the bank': 'ank',

    // --- 'ick' family — pick, quick, trick, sick ---
    'do the trick': 'ick', 'take your pick': 'ick', 'brick by brick': 'ick',
    'makes me sick': 'ick', 'candle wick': 'ick', 'hat trick': 'ick',
    'real slick': 'ick', 'time will tick': 'ick', 'pretty thick': 'ick',
    'sidekick': 'ick', 'drumstick': 'ick', 'double quick': 'ick',

    // --- 'ip' family — trip, ship, grip, flip ---
    'let it rip': 'ip', 'lose my grip': 'ip', 'sinking ship': 'ip',
    'road trip': 'ip', 'power trip': 'ip', 'give a tip': 'ip',
    'ego trip': 'ip', 'read my lip': 'ip', 'crack the whip': 'ip',
    'guilt trip': 'ip', 'battleship': 'ip', 'scholarship': 'ip',
    'leadership': 'ip', 'fellowship': 'ip', 'ownership': 'ip',

    // --- 'ink' family — think, drink, link, sink ---
    'on the brink': 'ink', 'stop and think': 'ink', 'missing link': 'ink',
    'kitchen sink': 'ink', 'in the pink': 'ink', 'what you think': 'ink',
    'skating rink': 'ink', 'weak link': 'ink', 'let me think': 'ink',
    'hearts that sync': 'ink', 'blink of eye': 'ink', 'on the drink': 'ink',

    // --- 'it' family — hit, bit, sit, spit ---
    'perfect fit': 'it', 'counterfeit': 'it', 'benefit': 'it',
    'never quit': 'it', 'legit': 'it', 'holy writ': 'it',
    'mega hit': 'it', 'little bit': 'it', 'do your bit': 'it',
    'quick wit': 'it', 'bottomless pit': 'it', 'hard to admit': 'it',
    'permit': 'it', 'direct hit': 'it', 'smash hit': 'it',

    // --- 'ot' family — not, got, hot, shot ---
    'hit the spot': 'ot', 'give it a shot': 'ot', 'like it or not': 'ot',
    'boiling hot': 'ot', 'tie the knot': 'ot', 'what i got': 'ot',
    'parking lot': 'ot', 'hit the jackpot': 'ot', 'best i got': 'ot',
    'big shot': 'ot', 'connect the dot': 'ot', 'on the spot': 'ot',

    // --- 'op' family — stop, drop, top, pop ---
    'over the top': 'op', 'make it stop': 'op', 'let it drop': 'op',
    'cant stop': 'op', 'body drop': 'op', 'jaws will drop': 'op',
    'from the top': 'op', 'belly flop': 'op', 'nonstop': 'op',
    'barbershop': 'op', 'mountaintop': 'op', 'window shop': 'op',

    // --- 'ack' family — back, track, stack, black ---
    'under attack': 'ack', 'off the track': 'ack', 'got my back': 'ack',
    'heart attack': 'ack', 'cutting slack': 'ack', 'on the rack': 'ack',
    'fade to black': 'ack', 'paper stack': 'ack', 'money stack': 'ack',
    'turning back': 'ack', 'hit the sack': 'ack', 'on my back': 'ack',
    'stay on track': 'ack', 'quarter back': 'ack', 'sneak attack': 'ack',

    // --- 'ag' family — bag, tag, flag, drag ---
    'body bag': 'ag', 'money bag': 'ag', 'wave the flag': 'ag',
    'name the tag': 'ag', 'gift to brag': 'ag', 'raising flag': 'ag',
    'price tag': 'ag', 'punching bag': 'ag', 'lagging drag': 'ag',

    // --- 'ap' family — trap, snap, wrap, clap ---
    'its a trap': 'ap', 'thunder clap': 'ap', 'on the map': 'ap',
    'close the gap': 'ap', 'gift to wrap': 'ap', 'take a nap': 'ap',
    'dirt nap': 'ap', 'cold snap': 'ap', 'booby trap': 'ap',
    'mind the gap': 'ap', 'world map': 'ap', 'off the map': 'ap',

    // --- 'atch' family — catch, match, watch, scratch ---
    'perfect match': 'atch', 'from the scratch': 'atch', 'you cant catch': 'atch',
    'no match': 'atch', 'time to watch': 'atch', 'start from scratch': 'atch',
    'mix and match': 'atch', 'safety catch': 'atch', 'door to latch': 'atch',

    // --- 'ash' family — crash, flash, cash, splash ---
    'in a flash': 'ash', 'cold hard cash': 'ash', 'make a splash': 'ash',
    'grow a stash': 'ash', 'thunder clash': 'ash', 'whiplash': 'ash',
    'lightning flash': 'ash', 'car will crash': 'ash', 'pile of cash': 'ash',
    'burning ash': 'ash', 'spend the cash': 'ash', 'quick as flash': 'ash',

    // --- 'aw' family — saw, raw, draw, law ---
    'what i saw': 'aw', 'above the law': 'aw', 'final straw': 'aw',
    'quick draw': 'aw', 'in the raw': 'aw', 'fatal flaw': 'aw',
    'last straw': 'aw', 'south paw': 'aw', 'stand in awe': 'aw',

    // --- 'oil' family — soil, toil, coil, broil ---
    'blood and toil': 'oil', 'tin foil': 'oil', 'on the boil': 'oil',
    'midnight oil': 'oil', 'loyal and royal': 'oil', 'inner turmoil': 'oil',
    'burn the oil': 'oil', 'aluminum foil': 'oil', 'hard soil': 'oil',

    // --- 'oy' family — boy, joy, enjoy, destroy ---
    'golden boy': 'oy', 'pride and joy': 'oy', 'search and destroy': 'oy',
    'real mccoy': 'oy', 'pretty boy': 'oy', 'bundle of joy': 'oy',
    'bad boy': 'oy', 'home boy': 'oy', 'bring the joy': 'oy',
    'oh boy': 'oy', 'just a toy': 'oy', 'decoy ploy': 'oy',

    // --- 'ang' family — sang, hang, bang, gang ---
    'let it hang': 'ang', 'big bang': 'ang', 'boomerang': 'ang',
    'chain gang': 'ang', 'loud bang': 'ang', 'wild mustang': 'ang',
    'sharp fang': 'ang', 'slang that hang': 'ang', 'head will hang': 'ang',

    // --- 'ock' family — rock, block, clock, knock ---
    'round the block': 'ock', 'on the clock': 'ock', 'pick the lock': 'ock',
    'round the clock': 'ock', 'writers block': 'ock', 'laughing stock': 'ock',
    'aftershock': 'ock', 'gridlock': 'ock', 'don\'t stop': 'ock',
    'hard as rock': 'ock', 'knock knock': 'ock', 'stumbling block': 'ock',
    'ticking clock': 'ock', 'solid rock': 'ock', 'culture shock': 'ock',

    // --- 'ool' family — cool, fool, school, rule ---
    'play it cool': 'ool', 'golden rule': 'ool', 'acting fool': 'ool',
    'swimming pool': 'ool', 'old school': 'ool', 'power tool': 'ool',
    'keep your cool': 'ool', 'april fool': 'ool', 'break the rule': 'ool',
    'born to rule': 'ool', 'high school': 'ool', 'gene pool': 'ool',

    // --- 'oose' family — loose, goose, juice, truce ---
    'on the loose': 'oose', 'no excuse': 'oose', 'what the use': 'oose',
    'call a truce': 'oose', 'introduce': 'oose', 'self abuse': 'oose',
    'cut me loose': 'oose', 'turn it loose': 'oose', 'orange juice': 'oose',
    'wild goose': 'oose', 'reproduce': 'oose', 'hang the noose': 'oose',

    // --- 'ing' family — king, ring, thing, bring ---
    'hear it ring': 'ing', 'let me sing': 'ing', 'in the ring': 'ing',
    'real thing': 'ing', 'golden ring': 'ing', 'offering': 'ing',
    'suffering': 'ing', 'gathering': 'ing', 'happening': 'ing',
    'diamond ring': 'ing', 'cash is king': 'ing', 'do your thing': 'ing',
    'wedding ring': 'ing', 'what they bring': 'ing', 'wild fling': 'ing',
    'chicken wing': 'ing', 'hear me sing': 'ing', 'left the ring': 'ing',

    // --- 'ill' family — will, kill, still, thrill ---
    'fit the bill': 'ill', 'over the hill': 'ill', 'bitter pill': 'ill',
    'dollar bill': 'ill', 'stand still': 'ill', 'iron will': 'ill',
    'overkill': 'ill', 'window sill': 'ill', 'get the thrill': 'ill',
    'dressed to kill': 'ill', 'fire at will': 'ill', 'going downhill': 'ill',
    'sugar pill': 'ill', 'pop a pill': 'ill', 'jack and jill': 'ill',

    // --- 'an' family — man, plan, can, fan ---
    'master plan': 'an', 'also ran': 'an', 'garbage can': 'an',
    'hit the fan': 'an', 'moving van': 'an', 'frying pan': 'an',
    'leading man': 'an', 'business plan': 'an', 'if i can': 'an',
    'yes i can': 'an', 'common man': 'an', 'bogey man': 'an',
    'game plan': 'an', 'old man': 'an', 'young man': 'an',

    // --- 'een' family — mean, clean, scene, screen ---
    'on the scene': 'een', 'what i mean': 'een', 'come clean': 'een',
    'big screen': 'een', 'time machine': 'een', 'evergreen': 'een',
    'live the dream': 'een', 'in between': 'een', 'squeaky clean': 'een',
    'silver screen': 'een', 'sight unseen': 'een', 'lean and mean': 'een',
    'turning green': 'een', 'halloween': 'een', 'behind the scene': 'een',

    // --- 'ames' family — James, flames, games ---
    'hall of flames': 'ames', 'callin names': 'ames', 'playing games': 'ames',
    'staking claims': 'ames', 'picture frames': 'ames', 'mind games': 'ames',
    'war games': 'ames', 'golden frames': 'ames', 'call out names': 'ames',

    // --- 'ize' family — rise, wise, eyes, surprise ---
    'on the rise': 'ize', 'open eyes': 'ize', 'by surprise': 'ize',
    'exercise': 'ize', 'compromise': 'ize', 'otherwise': 'ize',
    'supervise': 'ize', 'improvise': 'ize', 'advertise': 'ize',
    'close your eyes': 'ize', 'word to the wise': 'ize', 'in disguise': 'ize',
    'telling lies': 'ize', 'starry skies': 'ize', 'butterflies': 'ize',
    'cut to size': 'ize', 'clear blue skies': 'ize', 'realize': 'ize',

    // --- 'ation' family — nation, creation, inspiration ---
    'whole creation': 'ation', 'conversation': 'ation', 'education': 'ation',
    'dedication': 'ation', 'inspiration': 'ation', 'imagination': 'ation',
    'generation': 'ation', 'celebration': 'ation', 'reputation': 'ation',
    'determination': 'ation', 'expectation': 'ation', 'concentration': 'ation',
    'demonstration': 'ation', 'transportation': 'ation', 'confrontation': 'ation',
    'consideration': 'ation', 'recommendation': 'ation', 'administration': 'ation',

    // --- 'otion' family — motion, ocean, emotion, devotion ---
    'locomotion': 'otion', 'set in motion': 'otion', 'magic potion': 'otion',
    'deep devotion': 'otion', 'pure emotion': 'otion', 'slow motion': 'otion',
    'raw emotion': 'otion', 'love potion': 'otion', 'causing commotion': 'otion',
    'forward motion': 'otion', 'wild emotion': 'otion', 'whole ocean': 'otion',

    // --- 'ision' family — vision, decision, mission, position ---
    'television': 'ision', 'tunnel vision': 'ision', 'double vision': 'ision',
    'final decision': 'ision', 'clear precision': 'ision', 'on a mission': 'ision',
    'night vision': 'ision', 'losing position': 'ision', 'bold ambition': 'ision',
    'my condition': 'ision', 'superstition': 'ision', 'ammunition': 'ision',
    'snap decision': 'ision', 'split decision': 'ision', 'pole position': 'ision',

    // --- 'usion' family — confusion, illusion, conclusion ---
    'mass confusion': 'usion', 'grand illusion': 'usion', 'final conclusion': 'usion',
    'total delusion': 'usion', 'self exclusion': 'usion', 'cold fusion': 'usion',
    'lost in confusion': 'usion', 'optical illusion': 'usion', 'blood transfusion': 'usion',
    'mass explosion': 'usion', 'slow erosion': 'usion', 'inner revolution': 'usion',
    'no solution': 'usion', 'air pollution': 'usion', 'evolution': 'usion',

    // --- 'ession' family — session, confession, expression ---
    'first impression': 'ession', 'deep obsession': 'ession',
    'learn a lesson': 'ession', 'under pressure': 'ession',
    'self expression': 'ession', 'dark confession': 'ession',
    'life lesson': 'ession', 'in succession': 'ession', 'false impression': 'ession',
    'deep depression': 'ession', 'pure aggression': 'ession', 'cold obsession': 'ession',

    // --- 'assion' family — passion, fashion, compassion ---
    'burning passion': 'assion', 'high fashion': 'assion',
    'deep compassion': 'assion', 'out of fashion': 'assion',
    'true passion': 'assion', 'new fashion': 'assion', 'old fashion': 'assion',
    'lost all passion': 'assion', 'dark passion': 'assion', 'raw passion': 'assion',
    'showing compassion': 'assion', 'no compassion': 'assion',

    // --- 'ity' family — city, gravity, reality ---
    'inner city': 'ity', 'nitty gritty': 'ity', 'show no pity': 'ity',
    'pure insanity': 'ity', 'harsh reality': 'ity', 'zero gravity': 'ity',
    'lost my sanity': 'ity', 'electricity': 'ity', 'equal opportunity': 'ity',
    'mental capacity': 'ity', 'pure velocity': 'ity', 'true identity': 'ity',
    'my integrity': 'ity', 'full authority': 'ity', 'originality': 'ity',

    // --- 'ence' family — experience, confidence, violence ---
    'in my experience': 'ence', 'show some patience': 'ence', 'total silence': 'ence',
    'self defense': 'ence', 'makes no difference': 'ence', 'pure intelligence': 'ence',
    'strong resistance': 'ence', 'mere existence': 'ence', 'self confidence': 'ence',
    'inner violence': 'ence', 'zero tolerance': 'ence', 'raw brilliance': 'ence',
    'without a conscience': 'ence', 'sheer dominance': 'ence', 'mass surveillance': 'ence',

    // --- 'ory' family — story, glory, victory, memory ---
    'end of story': 'ory', 'morning glory': 'ory', 'claim the victory': 'ory',
    'distant memory': 'ory', 'ancient history': 'ory', 'unsolved mystery': 'ory',
    'true story': 'ory', 'life story': 'ory', 'hall of glory': 'ory',
    'old and gory': 'ory', 'territory': 'ory', 'mandatory': 'ory',

    // --- 'ment' family — moment, movement, excitement ---
    'in the moment': 'ment', 'big achievement': 'ment', 'pure excitement': 'ment',
    'total amazement': 'ment', 'silent movement': 'ment', 'swift judgment': 'ment',
    'final statement': 'ment', 'bold commitment': 'ment', 'harsh punishment': 'ment',
    'no improvement': 'ment', 'sweet enchantment': 'ment', 'full investment': 'ment',
    'self employment': 'ment', 'empowerment': 'ment', 'lack of judgment': 'ment',

    // --- 'ful' family — beautiful, powerful, wonderful ---
    'so beautiful': 'ful', 'most powerful': 'ful', 'truly wonderful': 'ful',
    'ever grateful': 'ful', 'always faithful': 'ful', 'so delightful': 'ful',
    'deeply sorrowful': 'ful', 'remain hopeful': 'ful', 'so distasteful': 'ful',
    'highly skillful': 'ful', 'very cheerful': 'ful', 'quite insightful': 'ful',

    // --- 'ous' family — dangerous, glamorous, mysterious ---
    'so dangerous': 'ous', 'truly glamorous': 'ous', 'dark and mysterious': 'ous',
    'so outrageous': 'ous', 'brave courageous': 'ous', 'dead serious': 'ous',
    'absolutely ridiculous': 'ous', 'getting nervous': 'ous', 'so notorious': 'ous',
    'most glorious': 'ous', 'pure and virtuous': 'ous', 'wild and furious': 'ous',

    // --- 'ude' family — attitude, gratitude, mood, rude ---
    'bad attitude': 'ude', 'show some gratitude': 'ude', 'in the mood': 'ude',
    'deep solitude': 'ude', 'high magnitude': 'ude', 'being rude': 'ude',
    'inner fortitude': 'ude', 'change the mood': 'ude', 'soul food': 'ude',
    'multitude': 'ude', 'total servitude': 'ude', 'so crude': 'ude',

    // --- 'oop' family — loop, group, scoop, troop ---
    'out the loop': 'oop', 'in the group': 'oop', 'got the scoop': 'oop',
    'inner loop': 'oop', 'regroup': 'oop', 'loop the loop': 'oop',
    'hula hoop': 'oop', 'troop by troop': 'oop', 'chicken coop': 'oop',

    // --- 'ast' family — last, fast, past, blast ---
    'built to last': 'ast', 'running fast': 'ast', 'hold on fast': 'ast',
    'nuclear blast': 'ast', 'shadow of past': 'ast', 'living fast': 'ast',
    'from the past': 'ast', 'full on blast': 'ast', 'unsurpassed': 'ast',
    'standing fast': 'ast', 'growing fast': 'ast', 'die hard cast': 'ast',

    // --- 'ex' family — flex, next, complex ---
    'what comes next': 'ex', 'show the flex': 'ex', 'ultra complex': 'ex',
    'final text': 'ex', 'special effects': 'ex', 'rubber checks': 'ex',
    'show respect': 'ex', 'hard to flex': 'ex', 'chain around neck': 'ex',

    // --- 'iller' family — killer, thriller, gorilla ---
    'born a killer': 'iller', 'movie thriller': 'iller', 'pure vanilla': 'iller',
    'city gorilla': 'iller', 'pain killer': 'iller', 'lady killer': 'iller',
    'guerilla': 'iller', 'caterpillar': 'iller', 'drug dealer': 'iller',

    // --- 'arker' family — darker, marker, Parker ---
    'in the darker': 'arker', 'hit the marker': 'arker',
    'getting darker': 'arker', 'permanent marker': 'arker',
    'growing darker': 'arker', 'night gets darker': 'arker',

    // --- 'action' family — Jackson, traction, satisfaction ---
    'back in': 'action', 'stackin': 'action', 'trackin': 'action',
    'packin': 'action', 'crackin': 'action', 'attackin': 'action',
    'jackin': 'action', 'lackin': 'action', 'smackin': 'action',
    'wrappin': 'action', 'cappin': 'action', 'snappin': 'action',
    'chain reaction': 'action', 'main attraction': 'action', 'take the action': 'action',
    'live the action': 'action', 'pure satisfaction': 'action', 'fatal attraction': 'action',

    // --- 'ust2' family — boss, loss, cross, Ross ---
    'like a boss': 'ust2', 'total loss': 'ust2', 'double cross': 'ust2',
    'albatross': 'ust2', 'come across': 'ust2', 'at a loss': 'ust2',
    'the big boss': 'ust2', 'bear a cross': 'ust2', 'coin to toss': 'ust2',
    'dental floss': 'ust2', 'feeling lost': 'ust2', 'nails and cross': 'ust2',

    // --- 'em' family — them, gem, system, problem ---
    'all of them': 'em', 'problem': 'em', 'requiem': 'em',
    'stratagem': 'em', 'diadem': 'em', 'condemn': 'em',
    'all of em': 'em', 'most of em': 'em', 'hidden gem': 'em',
    'broken system': 'em', 'beat the rhythm': 'em', 'national anthem': 'em',

    // --- 'ooley' family — Woolery, foolery, jewelry, tomfoolery ---
    'cool to be': 'ooley', 'cool to me': 'ooley', 'foolin me': 'ooley',
    'pullin gs': 'ooley', 'school for me': 'ooley', 'fool to be': 'ooley',
    'cruel to me': 'ooley', 'truly be': 'ooley', 'unruly g': 'ooley',
    'newly free': 'ooley', 'cool and free': 'ooley', 'rule for me': 'ooley',
    'pool to me': 'ooley', 'tool for me': 'ooley', 'drool on me': 'ooley',

    // --- 'ub' family — club, hub, scrub ---
    'in the club': 'ub', 'belly rub': 'ub', 'bathtub': 'ub',
    'night club': 'ub', 'grub hub': 'ub', 'country club': 'ub',

    // --- 'ust3' family — just, trust, dust ---
    'earn my trust': 'ust3', 'bite the dust': 'ust3', 'gold to rust': 'ust3',
    'must adjust': 'ust3', 'pure disgust': 'ust3', 'blood and dust': 'ust3',

    // --- 'ated' family — past tense -ated words ---
    'truly devastated': 'ated', 'over compensated': 'ated', 'never celebrated': 'ated',
    'highly rated': 'ated', 'long awaited': 'ated', 'underestimated': 'ated',
    'always hated': 'ated', 'complicated': 'ated', 'annihilated': 'ated',
    'so frustrated': 'ated', 'intoxicated': 'ated', 'freshly created': 'ated',

    // --- 'ized' family — past tense -ized words ---
    'traumatized': 'ized', 'ostracized': 'ized', 'vandalized': 'ized',
    'memorized': 'ized', 'paralyzed': 'ized', 'realized': 'ized',
    'mesmerized': 'ized', 'weaponized': 'ized', 'galvanized': 'ized',
    'improvised': 'ized', 'criticized': 'ized', 'brutalized': 'ized',

    // --- 'oken' family — broken, spoken, woken ---
    'heart is broken': 'oken', 'softly spoken': 'oken', 'barely woken': 'oken',
    'truth was spoken': 'oken', 'not yet broken': 'oken', 'golden token': 'oken',
    'words i spoken': 'oken', 'spirit broken': 'oken', 'finally woken': 'oken',

    // --- 'iven' family — driven, given, forgiven ---
    'heaven driven': 'iven', 'god has given': 'iven', 'not forgiven': 'iven',
    'money driven': 'iven', 'all is given': 'iven', 'been forbidden': 'iven',
    'passion driven': 'iven', 'gift thats given': 'iven', 'hate and hidden': 'iven',

    // --- 'otten' family — forgotten, rotten, gotten ---
    'not forgotten': 'otten', 'ill gotten': 'otten', 'something rotten': 'otten',
    'old and rotten': 'otten', 'long forgotten': 'otten', 'misbegotten': 'otten',

    // --- 'anded' family — demanded, commanded, stranded ---
    'they demanded': 'anded', 'left me stranded': 'anded', 'heavy handed': 'anded',
    'empty handed': 'anded', 'single handed': 'anded', 'finally landed': 'anded',
    'rough and branded': 'anded', 'so commanded': 'anded', 'back handed': 'anded',

    // --- 'ended' family — defended, offended, pretended ---
    'never ended': 'ended', 'well defended': 'ended', 'deeply offended': 'ended',
    'highly recommended': 'ended', 'time extended': 'ended', 'rules i bended': 'ended',
    'hearts i mended': 'ended', 'life suspended': 'ended', 'truth descended': 'ended',

    // --- 'ected' family — connected, protected, respected ---
    'highly respected': 'ected', 'deeply connected': 'ected', 'fully protected': 'ected',
    'never expected': 'ected', 'falsely rejected': 'ected', 'been neglected': 'ected',
    'been disrespected': 'ected', 'newly elected': 'ected', 'misdirected': 'ected',
    'deeply affected': 'ected', 'not detected': 'ected', 'resurrected': 'ected',

    // --- 'pted' family — accepted, corrupted, interrupted ---
    'fully accepted': 'pted', 'power corrupted': 'pted', 'been interrupted': 'pted',
    'plans disrupted': 'pted', 'quickly adapted': 'pted', 'finally adopted': 'pted',
    'never accepted': 'pted', 'lives erupted': 'pted', 'peace disrupted': 'pted',

    // --- 'ured' family — endured, captured, measured ---
    'pain endured': 'ured', 'heart was captured': 'ured', 'carefully measured': 'ured',
    'finally matured': 'ured', 'soul was tortured': 'ured', 'carefully nurtured': 'ured',
    'love is treasured': 'ured', 'beautifully structured': 'ured', 'been manufactured': 'ured',

    // --- 'overed' family — discovered, recovered, uncovered ---
    'newly discovered': 'overed', 'finally recovered': 'overed', 'truth uncovered': 'overed',
    'barely covered': 'overed', 'always hovered': 'overed', 'been smothered': 'overed',
    'secrets uncovered': 'overed', 'never recovered': 'overed', 'freshly discovered': 'overed',
};

// Build compound reverse lookup for efficiency
const COMPOUND_TO_FAMILY = {};
for (const [phrase, family] of Object.entries(COMPOUND_RHYMES)) {
    COMPOUND_TO_FAMILY[phrase] = family;
}

// Normalize text for compound rhyme lookup
function normalizeForCompound(text) {
    return text.toLowerCase()
        .replace(/'/g, '')        // "foolin'" → "foolin", "pullin'" → "pullin"
        .replace(/[^a-z\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Normalize slang contractions for rhyme matching.
 * "foolin'" → "foolin", "sippin'" → "sippin", "stackin'" → "stackin"
 * Also normalizes "ing" → "in" for hip hop slang matching.
 * @param {string} word
 * @returns {string[]} array of normalized forms to try
 */
function getSlangVariants(word) {
    const w = word.toLowerCase().replace(/[^a-z']/g, '');
    const variants = [w];
    // "foolin'" → "foolin" → also try "fooling"
    if (w.endsWith("'")) {
        variants.push(w.slice(0, -1));
    }
    if (w.endsWith("in'") || w.endsWith("in")) {
        const base = w.replace(/in'?$/, '');
        variants.push(base + 'in');
        variants.push(base + 'ing');
    }
    // "sippin" → also try "sipping"
    if (w.endsWith('in') && !w.endsWith('ain') && !w.endsWith('oin') && !w.endsWith('win')) {
        variants.push(w + 'g');
    }
    return [...new Set(variants.map(v => v.replace(/'/g, '')))];
}

// ============================================================================
// PHONETIC SIMILARITY ENGINE
// Extracts vowel sound patterns and compares for fuzzy matching
// Enables Eminem-style slant rhymes at 60-70% phonetic similarity
// ============================================================================

// Vowel digraph → phonetic code mappings (longer patterns checked first)
const VOWEL_DIGRAPHS = [
    ['ough', 'O'], ['igh', 'I'], ['oo', 'U'], ['ee', 'E'],
    ['ea', 'E'], ['ai', 'A'], ['ay', 'A'], ['ey', 'A'],
    ['oi', 'Y'], ['oy', 'Y'], ['ou', 'W'], ['ow', 'W'],
    ['aw', 'O'], ['au', 'O'], ['ie', 'E'],
];

/**
 * Extract simplified vowel sound pattern from text.
 * Returns last 4 vowel sounds for comparison.
 * @param {string} text
 * @returns {string}
 */
function extractVowelPattern(text) {
    let t = text.toLowerCase().replace(/[^a-z\s]/g, '').trim();
    for (const [pattern, code] of VOWEL_DIGRAPHS) {
        t = t.replace(new RegExp(pattern, 'g'), code);
    }
    const vowelChars = t.replace(/[^UEAYWIOaeiou]/g, '');
    return vowelChars.slice(-4);
}

/**
 * Compute similarity between two vowel patterns (0-1).
 * Compares from the end (most important for rhyming).
 * @param {string} v1
 * @param {string} v2
 * @returns {number}
 */
function vowelSimilarity(v1, v2) {
    if (!v1 || !v2) return 0;
    if (v1 === v2) return 1.0;
    const maxLen = Math.max(v1.length, v2.length);
    if (maxLen === 0) return 0;
    let matches = 0;
    const compareLen = Math.min(v1.length, v2.length, 4);
    for (let i = 0; i < compareLen; i++) {
        if (v1[v1.length - 1 - i] === v2[v2.length - 1 - i]) {
            matches += (i === 0) ? 2 : 1; // Last sound worth double
        }
    }
    const maxScore = compareLen + 1;
    return matches / maxScore;
}

/**
 * Check if two text fragments rhyme via fuzzy phonetic matching.
 * @param {string} text1
 * @param {string} text2
 * @param {number} threshold - minimum similarity (0.6 = 60%)
 * @returns {boolean}
 */
function phoneticRhyme(text1, text2, threshold = 0.6) {
    const v1 = extractVowelPattern(text1);
    const v2 = extractVowelPattern(text2);
    return vowelSimilarity(v1, v2) >= threshold;
}

/**
 * Extract the last word from a line (lowercased, punctuation stripped).
 * @param {string} line
 * @returns {string}
 */
function getLastWord(line) {
    const words = line.trim().replace(/[^a-zA-Z\s'-]/g, '').split(/\s+/).filter(Boolean);
    return (words[words.length - 1] || '').toLowerCase();
}

/**
 * Get the phonetic ending of a word by finding its rhyme family.
 * Uses strict matching: only returns a family key if the word's suffix
 * exactly matches a family key, or the word is in the family dictionary.
 * @param {string} word
 * @returns {string}
 */
function getPhoneticEnding(word) {
    const w = word.toLowerCase().replace(/[^a-z]/g, '');
    if (w.length <= 1) return w;

    // First: check if the word is directly in a family
    if (WORD_TO_FAMILY[w] && WORD_TO_FAMILY[w].length > 0) {
        return WORD_TO_FAMILY[w][0];
    }

    // Second: check if the word's suffix exactly matches a family key
    // Try longer suffixes first for more precise matching
    for (let len = Math.min(5, w.length - 1); len >= 2; len--) {
        const suffix = w.slice(-len);
        if (RHYME_FAMILIES[suffix]) return suffix;
    }

    // Third: no match found — return raw suffix (won't match any family)
    return w.slice(-3);
}

/**
 * Check if two words rhyme.
 * Layer 1: Family dictionary matching (authoritative)
 * Layer 2: Compound rhyme matching (multi-word → family)
 * Layer 3: Suffix fallback (for unknown words)
 * Layer 4: Fuzzy phonetic matching (Eminem-style, 65% threshold)
 * @param {string} word1
 * @param {string} word2
 * @returns {boolean}
 */
export function wordsRhyme(word1, word2) {
    const w1 = word1.toLowerCase().replace(/[^a-z]/g, '');
    const w2 = word2.toLowerCase().replace(/[^a-z]/g, '');
    // Identical words are NOT a rhyme — they're just repetition
    if (w1 === w2) return false;

    // Check localized rhyme families first (for non-English generation)
    const activeWTF = getActiveWordToFamily();
    const isLocalized = activeWTF !== WORD_TO_FAMILY;
    if (isLocalized) {
        // For localized languages, use simplified matching on localized families
        const localW1 = word1.toLowerCase().replace(/[^a-z\u00C0-\u024F\u0400-\u04FF\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF\uAC00-\uD7AF\u0600-\u06FF\u0900-\u097F]/g, '');
        const localW2 = word2.toLowerCase().replace(/[^a-z\u00C0-\u024F\u0400-\u04FF\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF\uAC00-\uD7AF\u0600-\u06FF\u0900-\u097F]/g, '');
        if (localW1 === localW2) return false;
        const lf1 = activeWTF[localW1] || activeWTF[word1.toLowerCase()] || [];
        const lf2 = activeWTF[localW2] || activeWTF[word2.toLowerCase()] || [];
        for (const f of lf1) {
            if (lf2.includes(f)) return true;
        }
        // For localized, also try suffix matching (3+ chars)
        if (localW1.length >= 3 && localW2.length >= 3) {
            const s1 = localW1.slice(-3);
            const s2 = localW2.slice(-3);
            if (s1 === s2) return true;
        }
        return false;
    }

    // Layer 1: Check family membership (including slang variants)
    // "foolin'" → try "foolin", "fooling" etc.
    const variants1 = getSlangVariants(word1);
    const variants2 = getSlangVariants(word2);
    let families1 = [];
    let families2 = [];
    for (const v of variants1) {
        const f = WORD_TO_FAMILY[v];
        if (f) families1 = [...families1, ...f];
    }
    for (const v of variants2) {
        const f = WORD_TO_FAMILY[v];
        if (f) families2 = [...families2, ...f];
    }
    families1 = [...new Set(families1)];
    families2 = [...new Set(families2)];
    for (const f of families1) {
        if (families2.includes(f)) return true;
    }

    // Layer 2: Compound rhyme check
    const norm1 = normalizeForCompound(word1);
    const norm2 = normalizeForCompound(word2);
    const compound1 = COMPOUND_TO_FAMILY[norm1];
    const compound2 = COMPOUND_TO_FAMILY[norm2];
    if (compound1 && families2.includes(compound1)) return true;
    if (compound2 && families1.includes(compound2)) return true;
    if (compound1 && compound2 && compound1 === compound2) return true;

    // If BOTH words are in known families but no family overlap → they DON'T rhyme.
    if (families1.length > 0 && families2.length > 0) {
        return false; // Family check is authoritative when both are known
    }

    // Layer 3a: When ONE word is in a known family, check if the unknown word's
    // ending matches the family key. This is more precise than generic suffix matching.
    // e.g. "obliterated" (ated family) + "departed" (unknown) → "departed" doesn't end in "ated" → false
    // But "brent" (unknown) + "sent" (ent family) → "brent" ends in "ent" → true
    if (families1.length > 0 && families2.length === 0) {
        for (const fam of families1) {
            if (w2.endsWith(fam)) return true;
        }
        return false;
    }
    if (families2.length > 0 && families1.length === 0) {
        for (const fam of families2) {
            if (w1.endsWith(fam)) return true;
        }
        return false;
    }

    // Layer 3b: Suffix fallback — only used when NEITHER word is in any family
    const minLen = Math.min(w1.length, w2.length);
    const endsInIon = w1.endsWith('ion') && w2.endsWith('ion');
    if (endsInIon && minLen >= 5) {
        // Require 5-char match for -ion words to distinguish rhyme groups:
        // "-ation" (nation/creation) vs "-ction" (fiction/prediction) vs "-ision" (vision/decision)
        const suffix1 = w1.slice(-5);
        const suffix2 = w2.slice(-5);
        if (suffix1 === suffix2) return true;
        return false;
    }
    if (minLen >= 4) {
        // Require 4-char suffix match for unknown words (stricter than 3-char)
        const suffix1 = w1.slice(-4);
        const suffix2 = w2.slice(-4);
        if (suffix1 === suffix2) return true;
    }
    if (minLen >= 3 && Math.max(w1.length, w2.length) <= 5) {
        // Only allow 3-char suffix match for SHORT words (5 chars or less)
        // This catches "bet"/"set" but not "obliterated"/"departed"
        const suffix1 = w1.slice(-3);
        const suffix2 = w2.slice(-3);
        if (suffix1 === suffix2) return true;
    }

    // Layer 4: DISABLED — Fuzzy phonetic matching produced false positives
    // (e.g. "situation"/"johnson" = 0.667 similarity from single matching vowel).
    // Layers 1-3 (family dictionary + compound rhymes + suffix) are comprehensive
    // with 1000+ words across 40+ families and provide reliable matching.

    return false;
}

/**
 * Check if a phrase's ending rhymes with a target word.
 * Supports multi-word compound rhyming: "cool to be" ↔ "Woolery"
 * @param {string} phrase - full lyric line
 * @param {string} targetWord - word to rhyme with
 * @returns {boolean}
 */
export function phraseEndRhymes(phrase, targetWord) {
    // Standard single-word check first
    const lastWord = getLastWord(phrase);
    if (lastWord && wordsRhyme(targetWord, lastWord)) return true;

    // Multi-word compound check: try last 2 and 3 words
    const words = phrase.toLowerCase().replace(/[^a-z\s']/g, '').trim().split(/\s+/);
    const targetFamilies = WORD_TO_FAMILY[targetWord.toLowerCase().replace(/[^a-z]/g, '')] || [];

    if (words.length >= 2) {
        const last2 = words.slice(-2).join(' ');
        const compound2 = COMPOUND_TO_FAMILY[last2];
        if (compound2 && targetFamilies.includes(compound2)) return true;

        if (words.length >= 3) {
            const last3 = words.slice(-3).join(' ');
            const compound3 = COMPOUND_TO_FAMILY[last3];
            if (compound3 && targetFamilies.includes(compound3)) return true;
        }
    }

    // Reverse: target might be a compound phrase
    const targetCompound = COMPOUND_TO_FAMILY[normalizeForCompound(targetWord)];
    if (targetCompound && lastWord) {
        const lastWordFamilies = WORD_TO_FAMILY[lastWord.toLowerCase().replace(/[^a-z]/g, '')] || [];
        if (lastWordFamilies.includes(targetCompound)) return true;
    }

    // Fuzzy phonetic: DISABLED — same false-positive issue as wordsRhyme Layer 4.
    // "alextrebek" vs "rent" matched at 60% threshold, diluting real punchline matches.
    // Compound rhyme dictionary (last 2/3 words) handles multi-word rhymes correctly.

    return false;
}

/**
 * Find words that rhyme with the given word.
 * @param {string} word
 * @param {number} count - max number of rhymes to return
 * @param {function} rng - optional random function
 * @returns {string[]}
 */
export function findRhymes(word, count = 5, rng) {
    const activeFamilies = getActiveRhymeFamilies();
    const activeWTF = getActiveWordToFamily();
    const w = word.toLowerCase().replace(/[^a-z\u00C0-\u024F\u0400-\u04FF\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF\uAC00-\uD7AF\u0600-\u06FF\u0900-\u097F]/g, '');
    const families = activeWTF[w] || activeWTF[word.toLowerCase()] || [];
    const candidates = new Set();

    // Gather from known families (localized or English)
    for (const family of families) {
        const familyWords = activeFamilies[family];
        if (familyWords) {
            for (const rhymeWord of familyWords) {
                if (rhymeWord !== w) candidates.add(rhymeWord);
            }
        }
    }

    // If no family found, try phonetic ending match
    if (candidates.size === 0) {
        const ending = getPhoneticEnding(w);
        for (const [, words] of Object.entries(activeFamilies)) {
            for (const rw of words) {
                if (rw !== w && rw.endsWith(ending)) {
                    candidates.add(rw);
                }
            }
        }
    }

    const arr = Array.from(candidates);
    // Shuffle
    const rand = rng || Math.random;
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr.slice(0, count);
}

/**
 * Find a phrase from a pool that rhymes with a target word.
 * @param {string} targetWord - word to rhyme with
 * @param {string[]} phrasePool - array of phrases to search
 * @param {function} rng - random function
 * @returns {string|null}
 */
export function findRhymingPhrase(targetWord, phrasePool, rng) {
    const targetLower = targetWord.toLowerCase().replace(/[^a-z]/g, '');
    const candidates = phrasePool.filter(phrase => {
        const lastWord = getLastWord(phrase);
        if (!lastWord) return false;
        const lastLower = lastWord.toLowerCase().replace(/[^a-z]/g, '');
        // Reject same-word "rhymes" — e.g. opportunity/opportunity
        if (lastLower === targetLower) return false;
        // Standard single-word rhyme check
        if (wordsRhyme(targetWord, lastWord)) return true;
        // Multi-word compound rhyme check (e.g. "cool to be" ↔ "Woolery")
        return phraseEndRhymes(phrase, targetWord);
    });
    if (candidates.length === 0) return null;
    return candidates[Math.floor((rng ? rng() : Math.random()) * candidates.length)];
}

/**
 * Score how well a set of lines follows a rhyme scheme.
 * @param {string[]} lines
 * @param {string} scheme - e.g. 'AABB', 'ABAB', 'AAAA'
 * @returns {{ score: number, details: Array<{line: number, expected: string, actual: string, rhymes: boolean}> }}
 */
export function scoreRhymeScheme(lines, scheme) {
    if (!lines || lines.length === 0) return { score: 0, details: [] };

    const schemeChars = scheme.toUpperCase().split('');
    const details = [];
    const rhymeGroups = {}; // letter -> first word in group

    let matches = 0;
    let total = 0;

    for (let i = 0; i < lines.length && i < schemeChars.length; i++) {
        const letter = schemeChars[i];
        const lastWord = getLastWord(lines[i]);
        if (!lastWord) continue;

        if (!rhymeGroups[letter]) {
            // First occurrence of this letter — sets the rhyme target
            rhymeGroups[letter] = lastWord;
            details.push({ line: i, expected: letter, actual: lastWord, rhymes: true });
            matches++;
        } else {
            const rhymes = wordsRhyme(rhymeGroups[letter], lastWord);
            details.push({ line: i, expected: letter, actual: lastWord, target: rhymeGroups[letter], rhymes });
            if (rhymes) matches++;
        }
        total++;
    }

    return {
        score: total > 0 ? matches / total : 0,
        details,
    };
}

/**
 * Get the rhyme pattern of an array of lines (auto-detect).
 * Returns a string like 'AABB' or 'ABAB'.
 * @param {string[]} lines
 * @returns {string}
 */
export function detectRhymePattern(lines) {
    if (!lines || lines.length === 0) return '';

    const lastWords = lines.map(getLastWord);
    const pattern = [];
    const groupMap = {}; // word-family -> letter
    let nextLetter = 0;

    for (const word of lastWords) {
        if (!word) {
            pattern.push('X');
            continue;
        }
        let assigned = false;
        for (const [group, letter] of Object.entries(groupMap)) {
            if (wordsRhyme(word, group)) {
                pattern.push(letter);
                assigned = true;
                break;
            }
        }
        if (!assigned) {
            const letter = String.fromCharCode(65 + nextLetter);
            groupMap[word] = letter;
            pattern.push(letter);
            nextLetter++;
        }
    }

    return pattern.join('');
}

// =====================================================================
// MERGE EXPANSION DATA — COMPLETE AND UTTER DOMINATION
// =====================================================================
import { NEW_RHYME_FAMILIES, EXPANDED_RHYME_FAMILIES, mergeRhymeFamilies } from './RhymeEngineExpansion';

mergeRhymeFamilies(RHYME_FAMILIES, NEW_RHYME_FAMILIES, EXPANDED_RHYME_FAMILIES);

// Rebuild WORD_TO_FAMILY after expansion merge so expansion words are indexed
for (const [family, words] of Object.entries(RHYME_FAMILIES)) {
    for (const word of words) {
        if (!WORD_TO_FAMILY[word]) WORD_TO_FAMILY[word] = [];
        if (!WORD_TO_FAMILY[word].includes(family)) {
            WORD_TO_FAMILY[word].push(family);
        }
    }
}

// Merge Expansion 2 (5× rhyme families)
import { NEW_RHYME_FAMILIES_2, EXPANDED_RHYME_FAMILIES_2, mergeRhymeFamilies2 } from './RhymeEngineExpansion2';
mergeRhymeFamilies2(RHYME_FAMILIES, NEW_RHYME_FAMILIES_2, EXPANDED_RHYME_FAMILIES_2);

// Rebuild WORD_TO_FAMILY after expansion2 merge
for (const [family, words] of Object.entries(RHYME_FAMILIES)) {
    for (const word of words) {
        if (!WORD_TO_FAMILY[word]) WORD_TO_FAMILY[word] = [];
        if (!WORD_TO_FAMILY[word].includes(family)) {
            WORD_TO_FAMILY[word].push(family);
        }
    }
}

// Merge Expansion 3 (deeper rhyme variety)
import { NEW_RHYME_FAMILIES_3, EXPANDED_RHYME_FAMILIES_3, mergeRhymeFamilies3 } from './RhymeEngineExpansion3';
mergeRhymeFamilies3(RHYME_FAMILIES, NEW_RHYME_FAMILIES_3, EXPANDED_RHYME_FAMILIES_3);

// Rebuild WORD_TO_FAMILY after expansion3 merge
for (const [family, words] of Object.entries(RHYME_FAMILIES)) {
    for (const word of words) {
        if (!WORD_TO_FAMILY[word]) WORD_TO_FAMILY[word] = [];
        if (!WORD_TO_FAMILY[word].includes(family)) {
            WORD_TO_FAMILY[word].push(family);
        }
    }
}

export { RHYME_FAMILIES, COMPOUND_RHYMES, getLastWord, getPhoneticEnding, extractVowelPattern, vowelSimilarity, phoneticRhyme };
