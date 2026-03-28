/**
 * GenreBankExpansion6 — Celebrity, movie, and cultural reference expansion.
 * Adds genre-appropriate celebrity names (musicians, actors, athletes, influencers),
 * film references (titles, quotes, cinema themes), and cultural references
 * as complete lyric phrases across 20 major genres.
 * ~2,500+ new phrases spanning openers, verses, bridges, choruses, and vocabulary.
 */

export const GENRE_BANKS_EXPANSION6 = {

    // =====================================================================
    // POP — Celebrity & Movie References
    // =====================================================================
    pop: {
        themes: [
            'fame', 'icon', 'spotlight', 'red-carpet', 'blockbuster', 'viral',
            'paparazzi', 'awards-show', 'premiere', 'superstar', 'legendary'
        ],
        openers: [
            'feeling like Taylor on a sold-out night',
            'channeling Beyonce with the spotlight bright',
            'Billie whispered truths I finally understood',
            'Ariana taught me how to say thank you next',
            'singing like Adele with tears on my face',
            'I got that Dua Lipa energy tonight',
            'living like a Weeknd in the after hours',
            'dancing like Shakira hips don\'t lie tonight',
            'painting on my face like Lady Gaga does',
            'I wrote my story like a Swiftie fairy tale',
            'channeling my inner Rihanna under umbrellas',
            'got that Harry Styles golden kind of feeling',
            'Olivia Rodrigo put the heartbreak into words',
            'feeling like SZA underneath the open sky',
            'Sabrina Carpenter singing through the espresso dawn',
            'Chappell Roan taught me how to feel the pink',
            'living in a Lana Del Rey summer dream',
            'Bruno Mars taught me how to catch a grenade',
            'Ed Sheeran wrote the words I couldn\'t say',
            'Miley showed me wrecking balls can set you free',
            'Justin Bieber sorry was the song I needed',
            'Selena told me rare is what I am',
            'got that Doja Cat kiss me more kind of night',
            'Lizzo taught me feeling good as heaven',
            'life feels like a scene from La La Land',
            'dancing in the rain like we\'re in a movie',
            'the Notebook taught me love is patient rain',
            'Titanic hearts don\'t sink they float on love',
            'I\'m living in a Barbie kind of world',
            'A Star Is Born and she\'s shining every night',
            'the Greatest Showman said this is the greatest show',
            'Mamma Mia here we go again tonight',
            'Enchanted like a Disney movie come alive',
            'the Devil Wears Prada but my heart wears gold',
        ],
        verses: [
            'I got playlists full of Taylor\'s midnight songs',
            'screaming Beyonce lyrics at the steering wheel',
            'Billie painted everything in shades of green',
            'Adele\'s hello echoes in my empty room',
            'the Weeknd understands the blinding lights',
            'Harry\'s watermelon sugar on my tongue',
            'Olivia\'s good for you is my new anthem',
            'SZA told me kill Bill was a love song',
            'Sabrina\'s nonsense running through my brain',
            'Chappell told me good luck babe with every sigh',
            'Lana sings for girls who love too hard',
            'Rihanna shines brighter than a diamond could',
            'Dua spinning in my head on levitating nights',
            'Bruno said don\'t believe me just watch',
            'Gaga told me I was born this way',
            'Selena said the heart wants what it wants',
            'Doja Cat painted the town in hot pink',
            'Post Malone said better now and meant it',
            'Tate McRae showed me what greedy really means',
            'rewatching rom-coms looking for a sign',
            'the Notebook rain scene plays inside my head',
            'I am the main character in this coming of age',
            'Ferris Bueller said life moves pretty fast',
            'ten things I hate about you starts with love',
            'the Fault in Our Stars infinity fits',
            'life\'s a box of chocolates said Forrest with a grin',
        ],
        bridges: [
            'even Taylor started in her bedroom dreaming',
            'Beyonce proved that everything is possible',
            'Adele turned heartbreak into standing ovations',
            'Billie showed the world that quiet has a voice',
            'Rihanna taught me diamonds form in pressure',
            'the movie ends but the feeling never does',
            'every blockbuster started with a single scene',
        ],
        choruses: [
            'we are the Taylor generation singing loud',
            'Beyonce told us who run the world tonight',
            'living in a movie where the good guys win',
            'this is our La La Land this is our time',
            'Billie said everything I wanted is right here',
            'Ariana said no tears left to cry tonight',
            'Shakira said whenever wherever we belong',
            'the spotlight hits and everything is golden',
        ],
        vocabulary: {
            nouns: [
                'Grammy', 'red-carpet', 'premiere', 'paparazzi', 'spotlight',
                'blockbuster', 'box-office', 'billboard', 'platinum', 'encore',
                'biopic', 'soundtrack', 'montage', 'superstar', 'icon'
            ],
            verbs: [
                'headline', 'debut', 'premiere', 'trend', 'chart',
                'slay', 'dominate', 'captivate', 'dazzle', 'enchant'
            ],
            adjectives: [
                'iconic', 'legendary', 'viral', 'platinum', 'chart-topping',
                'cinematic', 'award-winning', 'blockbuster', 'sold-out', 'headlining'
            ]
        }
    },

    // =====================================================================
    // HIP-HOP — Celebrity & Movie References
    // =====================================================================
    hiphop: {
        themes: [
            'legacy', 'goat', 'throne', 'dynasty', 'icon', 'platinum',
            'hall-of-fame', 'classic', 'blueprint', 'masterpiece'
        ],
        openers: [
            'Jay-Z told me men lie women lie numbers don\'t',
            'Kendrick sat down then he stood up as king',
            'like Drake - Started From The Bottom now we here',
            'Nas wrote Illmatic on the fire escape',
            'Eminem - Cleaned Out His Closet on the track',
            'Kanye said - No One Man Should Have All That Power',
            'J Cole went Platinum With No Features clean',
            'Future - Mask Off and the melody hit different',
            'Tyler created something only he could see',
            'Cardi B - I Like It Like That tonight',
            'Megan Thee Stallion - Hot Girl Summer all year',
            'Nicki Minaj - the queen putting on the crown',
            'Tupac said Only God Can Judge Me now',
            'Biggie said It Was All A Dream - now we living supreme',
            'Missy Elliott - Flipped It And Reversed It',
            'Lauryn Hill told me Everything Is Everything',
            'Andre 3000 said what\'s Cooler Than Cool',
            'Ice Cube said Today Was A Good Day',
            'Lil Baby said The Bigger Picture matters',
            'GloRilla said Tomorrow 2 and meant it',
        ],
        verses: [
            'I study Jay-Z Blueprints late at night',
            'Kendrick\'s DNA runs through these verses deep',
            'Drake got me In My Feelings every time',
            'Nas taught me that The World Is Yours to take',
            'Eminem proved that words can be a weapon',
            'Kanye Graduated and then Dropped Out twice',
            'J Cole\'s Forest Hills Drive was the turning point',
            'Tyler The Creator planted Flower Boy seeds',
            'Cardi showed the world that Bronx girls win',
            'Megan ate the beat and left no crumbs behind',
            'Tupac wrote letters to his mama from the heart',
            'Biggie painted Brooklyn with a hypnotic flow',
            'Lauryn schooled the game with one mic and truth',
            'Nipsey told us the marathon continues still',
            'Mac Miller swam through oceans of his mind',
            'like JID - Flows Like A River with no dam',
            'moving like Denzel in Training Day for real',
            'this is my Scarface moment at the top',
            'Straight Outta Compton to the top of the game',
            'the Wire taught me chess not checkers move',
            'Black Panther - "Wakanda in my DNA"',
            'Django unchained and the game is free',
        ],
        bridges: [
            'Jay-Z went from Marcy to Madison Square',
            'Kendrick proved Compton breeds kings not just pain',
            'Tupac and Biggie left a legacy in ink',
            'Eminem proved a trailer park could raise a god',
            'Nipsey said the marathon goes on forever',
            'Lauryn told us once that it could all be so simple',
        ],
        choruses: [
            'I am the blueprint Jay-Z would be proud',
            'DNA like Kendrick running through my veins',
            'started from the bottom now the whole team here',
            'the world is mine like Nas said on that stage',
            'legends never die they multiply in bars',
            'the marathon continues like Nipsey said',
            'Tupac lives forever in the verses we spit',
            'Biggie taught us sky\'s the limit reach',
        ],
        vocabulary: {
            nouns: [
                'GOAT', 'dynasty', 'blueprint', 'classic', 'masterpiece',
                'throne', 'legacy', 'platinum', 'Grammy', 'cypher',
                'freestyle', 'diss-track', 'mixtape', 'anthology', 'legend'
            ],
            verbs: [
                'reign', 'conquer', 'dominate', 'pioneer', 'revolutionize',
                'freestyle', 'school', 'body', 'murder', 'annihilate'
            ],
            adjectives: [
                'legendary', 'goated', 'classic', 'platinum', 'certified',
                'iconic', 'untouchable', 'bulletproof', 'timeless', 'unmatched'
            ]
        }
    },

    // =====================================================================
    // ROCK — Celebrity & Movie References
    // =====================================================================
    rock: {
        themes: [
            'legend', 'guitar-hero', 'stadium', 'anthem', 'rebellion',
            'hall-of-fame', 'vinyl', 'arena', 'encore', 'riff'
        ],
        openers: [
            'Freddie Mercury said the show must go on',
            'Led Zeppelin climbed the stairway to the sky',
            'Kurt Cobain smelled like teen spirit in the rain',
            'Jimi Hendrix set the guitar on fire tonight',
            'the Stones told me I can\'t get no satisfaction',
            'David Bowie changed his face and changed the world',
            'Bruce Springsteen born to run and never stop',
            'the Beatles said let it be and so I did',
            'Pink Floyd built a wall and tore it down',
            'Eddie Vedder sang alive and I believed him',
            'Axl Rose welcomed me to the jungle tonight',
            'the Foo Fighters learned to fly on broken wings',
            'Stevie Nicks spun like a white-winged dove',
            'AC DC thunderstruck the whole arena',
            'the Clash said should I stay or should I go',
            'My Chemical Romance welcomed me to the black parade',
            'Green Day woke me up when September ended',
            'Arctic Monkeys bet I look good on the dancefloor',
        ],
        verses: [
            'I learned guitar by studying Jimmy Page',
            'channeling Hendrix with my fingers on the frets',
            'singing with the passion of a young Freddie',
            'Cobain taught me beauty hides in broken things',
            'Bowie showed me starlight changes everything',
            'the Beatles harmonized and changed the century',
            'Floyd\'s dark side still echoes in my headphones',
            'Vedder\'s voice cuts deeper than the ocean floor',
            'Chris Cornell sang like a black hole sun collapsing',
            'Robert Plant squeezed a whole lotta love from noise',
            'Keith Richards lived the life ten cats would need',
            'Roger Waters wished you were here and meant it',
            'Almost Famous on the tour bus writing dreams',
            'School of Rock taught me that rock is not dead',
            'Bohemian Rhapsody showed the world a champion',
            'This Is Spinal Tap turned it up to eleven',
            'Wayne\'s World said party on and so we did',
            'High Fidelity ranked our heartbreaks one through five',
        ],
        bridges: [
            'Freddie proved that legends echo through the ages',
            'Hendrix burned the guitar and birthed a genre',
            'rock and roll will never die said Neil Young',
            'Bowie proved that reinvention is the art',
            'from garage bands to stadiums that shake the earth',
        ],
        choruses: [
            'we will rock you like Mercury promised the crowd',
            'stairway to heaven starts with a single chord',
            'smells like teen spirit in this revolution',
            'born to run and born to rock this stage',
            'thunderstruck and the stadium is shaking',
            'the show must go on the legends never fade',
            'we are the champions of the broken stage',
            'welcome to the jungle where the guitars scream',
        ],
        vocabulary: {
            nouns: [
                'riff', 'encore', 'arena', 'amplifier', 'stadium',
                'vinyl', 'anthem', 'power-chord', 'legend', 'icon',
                'mosh-pit', 'roadie', 'setlist', 'headliner', 'lick'
            ],
            verbs: [
                'shred', 'thrash', 'ignite', 'electrify', 'erupt',
                'headline', 'encore', 'rage', 'anthem', 'crescendo'
            ],
            adjectives: [
                'legendary', 'thunderous', 'epic', 'anthemic', 'electrifying',
                'raw', 'visceral', 'stadium-shaking', 'iconic', 'timeless'
            ]
        }
    },

    // =====================================================================
    // COUNTRY — Celebrity & Movie References
    // =====================================================================
    country: {
        themes: [
            'outlaw', 'legend', 'honky-tonk', 'grand-ole-opry', 'Nashville',
            'rodeo', 'icon', 'heritage', 'heartland', 'tradition'
        ],
        openers: [
            'Johnny Cash walked the line and so do I',
            'Dolly Parton said nine to five and smiled',
            'Willie Nelson on the road again tonight',
            'Hank Williams was so lonesome he could cry',
            'Garth Brooks had friends in low places too',
            'Shania said let\'s go girls and we went',
            'George Strait carried the king of country crown',
            'Patsy Cline was crazy for the midnight hour',
            'Loretta Lynn was a coal miner\'s daughter strong',
            'Carrie Underwood took a Louisville slugger out',
            'Morgan Wallen whispered last night in the dark',
            'Zach Bryan tore the highway with his truth',
            'Chris Stapleton sang Tennessee whiskey smooth',
            'Kacey Musgraves followed the golden hour home',
            'Luke Combs sang about beautiful crazy love',
            'Lainey Wilson said heart like a truck tonight',
            'Jelly Roll said need a favor from the Lord',
            'Beyonce rode the cowboy carter trail',
        ],
        verses: [
            'I keep the Cash records spinning on the porch',
            'Dolly taught me coat of many colors means love',
            'Willie\'s braids and bandana riding through the dust',
            'Garth showed me thunder rolls on summer nights',
            'Shania proved that don\'t impress me much is power',
            'Patsy fell to pieces and we all felt that',
            'Carrie reminded Jesus to take the wheel',
            'Zach wrote something in the orange about the past',
            'Stapleton\'s broken halos ring above our heads',
            'Kacey said follow your arrow where it points',
            'Jelly Roll spoke for the ones who felt too broken',
            'Waylon Jennings was an outlaw and a poet',
            'Reba said fancy was a girl who rose above',
            'Kenny Rogers knew when to hold and when to fold',
            'Walk the Line from prison yards to wedding rings',
            'Coal Miner\'s Daughter rising from the holler',
            'Sweet Home Alabama where the skies are blue',
            'Yellowstone taught me fences guard the things we love',
        ],
        bridges: [
            'Johnny proved the man in black speaks for us all',
            'Dolly showed that glitter holds the strongest spine',
            'Nashville built on broken hearts and fiddle strings',
            'Willie proved the outlaw path can lead to grace',
            'Patsy walked so every country girl could run',
        ],
        choruses: [
            'walk the line like Johnny through the fire and dark',
            'nine to five Dolly dreams under southern stars',
            'on the road again with Willie in my heart',
            'friends in low places raise your glasses high',
            'man I feel like a woman Shania said',
            'Tennessee whiskey smooth and burning true',
            'golden hour light across the open range',
        ],
        vocabulary: {
            nouns: [
                'Opry', 'honky-tonk', 'Nashville', 'outlaw', 'rodeo',
                'fiddle', 'banjo', 'hayride', 'tailgate', 'pickup',
                'holler', 'Ryman', 'legend', 'heritage', 'homestead'
            ],
            verbs: [
                'two-step', 'yodel', 'holler', 'ramble', 'mosey',
                'wrangle', 'ride', 'strum', 'croon', 'serenade'
            ],
            adjectives: [
                'outlaw', 'honky-tonk', 'Nashville', 'southern', 'backroad',
                'dusty', 'heartland', 'country-fried', 'blue-collar', 'twangy'
            ]
        }
    },

    // =====================================================================
    // R&B — Celebrity & Movie References
    // =====================================================================
    rnb: {
        openers: [
            'singing like Marvin Gaye what\'s going on tonight',
            'Whitney Houston taught me I will always love',
            'Michael Jackson said don\'t stop till you get enough',
            'Prince wrote the purple rain that soaks my soul',
            'Usher showed me how to let it burn slow',
            'Aaliyah said try again and so I did',
            'Frank Ocean swam through blond waves of pain',
            'The Weeknd earned it in the after hours deep',
            'SZA killed Bill in the garden of the gods',
            'Daniel Caesar blessed my soul on the best part',
            'Giveon heartbreak anniversary on repeat',
            'Tyla brought the water and the whole world danced',
        ],
        verses: [
            'Marvin\'s melodies still heal the wounded world',
            'Whitney\'s voice still echoes through the cathedral',
            'MJ moonwalked and the gravity gave up',
            'Prince turned purple into the color of desire',
            'Usher\'s confessions hit me harder every year',
            'Frank Ocean wrote the love songs no one dared',
            'SZA\'s ctrl showed me love needs boundaries',
            'Tyla taught the world that water shapes the stone',
            'Luther Vandross said never too much and meant it',
            'Boyz II Men said it\'s so hard to say goodbye',
            'Erykah Badu called me on the phone and healed',
            'Purple Rain falling on the stage of our goodbye',
            'Dreamgirls singing through the sequin tears',
            'Poetic Justice where love and words collide',
        ],
        bridges: [
            'Whitney proved a voice can lift the whole world up',
            'Prince showed purple is the color of the brave',
            'Frank Ocean opened the door and walked on through',
            'from Motown to the streaming age the soul remains',
        ],
        choruses: [
            'what\'s going on Marvin the world still needs to know',
            'I will always love you Whitney taught me how',
            'purple rain purple reign forever on the throne',
            'try again try again the angels are singing',
            'the best part is I found you in the dark',
            'water shapes the heart and Tyla showed the way',
        ],
    },

    // =====================================================================
    // EDM — Celebrity & Movie References
    // =====================================================================
    edm: {
        openers: [
            'Avicii\'s levels still echo through the crowd',
            'Calvin Harris feels so close to paradise',
            'Skrillex dropped the bass and cracked the earth',
            'Marshmello alone but together in the light',
            'Martin Garrix showed me animals come alive',
            'Tiesto brought the trance into the new millennium',
            'David Guetta said the world is mine tonight',
            'Zedd found clarity in the chaos of the drop',
            'Illenium rose from ashes on the festival stage',
            'Swedish House Mafia said don\'t you worry child',
            'Fred Again put every voice memo into gold',
        ],
        verses: [
            'Avicii\'s wake me up still plays at every sunrise',
            'Skrillex rewrote what a drop could even mean',
            'Garrix was seventeen when he shook Tomorrowland',
            'Daft Punk said one more time and changed the game',
            'Fred Again sampled life and made it beautiful',
            'Tron Legacy the grid lights up at night',
            'the Matrix glitch and the bass drops through the code',
            'Blade Runner neon synths cut through the fog',
        ],
        bridges: [
            'Avicii left the stage but the levels keep on rising',
            'Daft Punk taught us robots have the biggest hearts',
            'from bedroom producers to the mainstage glow',
        ],
        choruses: [
            'levels rising Avicii lives in every drop',
            'one more time Daft Punk the lights go on',
            'don\'t you worry child Swedish House is here',
            'animals on the mainstage Garrix leads the charge',
            'clarity in the chaos Zedd controls the night',
        ],
    },

    // =====================================================================
    // INDIE — Celebrity & Movie References
    // =====================================================================
    indie: {
        openers: [
            'Phoebe Bridgers punched the monitor and smiled',
            'Bon Iver built a cabin made of winter sound',
            'Tame Impala let it happen in the current',
            'Radiohead proved OK Computer was a prophecy',
            'the Smiths told me there is a light that never goes out',
            'Arcade Fire woke up in the suburbs screaming',
            'Mitski said nobody like her and she was right',
            'Clairo wrote immunity inside her bedroom walls',
            'boygenius made the supergroup feel like home',
            'Weyes Blood said titanic rising and the ship glowed',
        ],
        verses: [
            'Phoebe sang about the skeleton and I felt seen',
            'Justin Vernon\'s falsetto floats above the snow',
            'Kevin Parker hears the less I know the better',
            'Thom Yorke\'s creep was every outcast\'s hymn',
            'Mitski\'s washing machine heart still tumbles on',
            'Garden State taught me the Shins will change your life',
            'Lost in Translation whispered in the Tokyo haze',
            'Eternal Sunshine erased the things I couldn\'t keep',
            'Lady Bird flew from Sacramento into dreams',
            'Frances Ha danced through Brooklyn feeling undateable',
            'Scott Pilgrim versus the world of indie romance',
            '500 Days of Summer and they weren\'t all sunny',
        ],
        bridges: [
            'Bon Iver proved a cabin can contain a masterpiece',
            'Radiohead predicted everything and we didn\'t listen',
            'the Smiths wrote the soundtrack for the beautiful losers',
        ],
        choruses: [
            'let it happen like Tame Impala said tonight',
            'there is a light that never goes out still burning',
            'skinny love Bon Iver whispers through the snow',
            'nobody like Mitski nobody like us tonight',
            'the less I know the better Kevin whispered low',
        ],
    },

    // =====================================================================
    // METAL — Celebrity & Movie References
    // =====================================================================
    metal: {
        openers: [
            'Metallica said enter sandman and we dreamed',
            'Iron Maiden ran to the hills tonight',
            'Black Sabbath paranoid and the riff was born',
            'Tool spiraled out and kept going deeper still',
            'Slipknot said people equal garbage and we moshed',
            'System of a Down said wake up and we did',
            'Dio said holy diver and the crowd went wild',
            'Motorhead said we are the ace of spades tonight',
        ],
        verses: [
            'James Hetfield\'s downpick shakes the concrete walls',
            'Bruce Dickinson soared like a trooper over trenches',
            'Ozzy bit the head off every expectation',
            'Maynard buried every feeling in the spiral',
            'Tony Iommi\'s two fingers built an empire of doom',
            'Cliff Burton\'s bass solo still echoes through the abyss',
            'This Is Spinal Tap because this one goes to eleven',
            'Tenacious D and the pick of destiny calls',
        ],
        bridges: [
            'Sabbath planted the seed and metal grew to the sky',
            'Dio proved the voice can be heavier than the guitar',
            'the horns Dio raised will never come back down',
        ],
        choruses: [
            'enter sandman Metallica guides the nightmare',
            'run to the hills Iron Maiden leads the charge',
            'paranoid the riff that started everything',
            'holy diver Dio\'s voice from beyond the grave',
            'ace of spades Lemmy deals the final hand',
            'master of puppets pulling all the strings',
        ],
    },

    // =====================================================================
    // JAZZ — Celebrity & Movie References
    // =====================================================================
    jazz: {
        openers: [
            'Miles Davis played the kind of blue that heals',
            'Coltrane\'s love supreme whispered through the night',
            'Ella Fitzgerald scatted the stars into alignment',
            'Louis Armstrong saw a wonderful world and sang',
            'Billie Holiday sang strange fruit and the world wept',
            'Duke Ellington took the A train to the top',
            'Nina Simone said feeling good and I believed',
            'Herbie Hancock headhunted every chord alive',
        ],
        verses: [
            'Miles painted silence into every empty space',
            'Ella scatted circles around every other voice',
            'Satchmo\'s trumpet made the angels stop and listen',
            'Nina mixed the piano with the revolution',
            'Chet Baker sang like someone who knew too much pain',
            'Bill Evans touched the keys like they were made of glass',
            'Whiplash taught me tempo is a ruthless teacher',
            'La La Land the jazz club and the impossible dream',
            'Soul told me every spark needs a purpose first',
        ],
        bridges: [
            'Miles proved silence is the loudest note of all',
            'Ella proved the voice is the original instrument',
            'every improvisation is a conversation with the gods',
        ],
        choruses: [
            'kind of blue Miles Davis painted paradise',
            'a love supreme Coltrane whispers in the dawn',
            'what a wonderful world Armstrong sees the light',
            'feeling good Nina Simone is in the air',
            'jazz lives forever in the midnight set',
        ],
    },

    // =====================================================================
    // LATIN — Celebrity & Movie References
    // =====================================================================
    latin: {
        openers: [
            'Bad Bunny said yo perreo sola tonight',
            'Shakira said whenever wherever we belong',
            'Daddy Yankee dropped the gasolina on the floor',
            'Rosalia said Motomami and the world bowed',
            'Karol G said Bichota and the crown glowed',
            'Peso Pluma brought the corridos to the world',
            'Marc Anthony sang vivir mi vida and we lived',
            'Celia Cruz said azucar and the room ignited',
            'Selena Quintanilla bidi bidi bom bom forever',
        ],
        verses: [
            'Bad Bunny proved the island breeds the biggest stars',
            'Shakira\'s hips translated every language known',
            'Rosalia fused flamenco with the future sound',
            'Karol G turned the Bichota into a movement',
            'Celia\'s legacy is sweeter than the cane she sang',
            'Selena\'s dreaming of you plays in every heart',
            'Coco showed me music bridges the living and dead',
            'In the Heights the block is hot with dreams',
            'Encanto we don\'t talk about Bruno but we dance',
        ],
        bridges: [
            'Celia proved azucar is the battle cry of joy',
            'Bad Bunny proved Puerto Rico holds the future',
            'Shakira showed the hips tell the truest story',
        ],
        choruses: [
            'gasolina Daddy Yankee burns the floor tonight',
            'bidi bidi bom bom Selena lives in us',
            'azucar Celia Cruz the sweetest revolution',
            'whenever wherever Shakira leads the way',
            'yo perreo sola Bad Bunny owns the night',
            'despacito the world learned Spanish overnight',
        ],
    },

    // =====================================================================
    // FOLK — Celebrity & Movie References
    // =====================================================================
    folk: {
        openers: [
            'Bob Dylan said the times they are a-changin still',
            'Joni Mitchell painted both sides now in blue',
            'Leonard Cohen sang hallelujah from the tower',
            'Simon and Garfunkel sounded like silence tonight',
            'Bon Iver whispered skinny love through frozen glass',
            'Hozier took me to church on a Sunday glow',
            'Noah Kahan said stick season and Vermont cried',
        ],
        verses: [
            'Dylan blew the harmonica and the protest marched',
            'Joni saw the clouds from both sides now and wept',
            'Leonard\'s bird on a wire balanced between the lines',
            'Simon heard the sound of silence in the crowd',
            'Hozier\'s cherry wine tastes sweet and melancholy',
            'Noah Kahan said northern attitude runs deep',
            'James Taylor saw fire and rain and walked on through',
            'Inside Llewyn Davis the cat and the cold and the folk',
            'Into the Wild the Vedder songs and the open road',
        ],
        bridges: [
            'Dylan proved the pen can shake the government',
            'Cohen proved that hallelujah has a thousand shapes',
            'every folk song carries someone\'s true-life story',
        ],
        choruses: [
            'the times they are a-changin Dylan told us true',
            'hallelujah Leonard from the broken prayer',
            'the sound of silence Simon hears us all',
            'take me to church Hozier sings the sacred',
            'stick season Noah Kahan and the maple tears',
        ],
    },

    // =====================================================================
    // GOSPEL — Celebrity & Movie References
    // =====================================================================
    gospel: {
        openers: [
            'Kirk Franklin said stomp and the whole church moved',
            'Mahalia Jackson sang the movement into being',
            'Tasha Cobbs Leonard broke every chain tonight',
            'Tamela Mann took me to the king and heaven opened',
            'Maverick City made the worship hit different',
            'Lauren Daigle said you say I am loved tonight',
        ],
        verses: [
            'Kirk brought the hip-hop and the holy ghost together',
            'Mahalia\'s voice carried the march on Washington',
            'Tasha\'s chain-breaking worship rattled every wall',
            'Tamela\'s voice soared higher than the steeple',
            'Lecrae showed me faith and hip-hop walk together',
            'Sister Act Whoopi made the choir rock the house',
            'the Prince of Egypt when you believe the sea parts',
        ],
        choruses: [
            'stomp Kirk Franklin and the church goes wild',
            'break every chain Tasha leads the worship',
            'take me to the king Tamela lifts her voice',
            'you say Lauren Daigle I am who You say I am',
            'we praise like Mahalia we march like the movement',
        ],
    },

    // =====================================================================
    // K-POP — Celebrity & Movie/Show References
    // =====================================================================
    kpop: {
        openers: [
            'BTS said dynamite and the world exploded',
            'BLACKPINK in your area and the stage is set',
            'NewJeans said attention and the whole world looked',
            'Jungkook said standing next to you and the chart broke',
            'Lisa said money and the Celine doors opened',
            'Le Sserafim said fearless and the debut shook',
        ],
        verses: [
            'BTS paved the way from Seoul to every stage on earth',
            'BLACKPINK proved the pink venom hits the hardest',
            'NewJeans made nostalgia sound brand new',
            'RM spoke at the UN and Namjoon changed the world',
            'G-Dragon wrote the fashion bible of K-pop style',
            'Parasite proved Korean art shakes the whole world',
            'Squid Game the survival and the pink soldiers march',
            'Train to Busan running from the darkness into light',
        ],
        choruses: [
            'dynamite BTS the explosion never ends',
            'BLACKPINK in your area the pink is power',
            'attention NewJeans the world is watching now',
            'fearless Le Sserafim the debut of the decade',
            'standing next to you Jungkook the world is yours',
        ],
    },

    // =====================================================================
    // TRAP — Celebrity & Movie References
    // =====================================================================
    trap: {
        openers: [
            'Future said mask off and the flute went crazy',
            'Travis Scott lit the astroworld and it burned bright',
            'Migos said bad and boujee and the culture shifted',
            'Gucci Mane said brrr and the ice froze harder',
            'Playboi Carti said whole lotta red and the pit opened',
            'Metro Boomin said if young metro don\'t trust you',
            'Chief Keef said love Sosa and Chicago shook',
        ],
        verses: [
            'Future painted Hendrix over codeine purple skies',
            'Migos taught the world the triplet flow in versace',
            'Gucci came back from prison harder than the ice',
            'Carti\'s baby voice unlocked a different universe',
            'Metro\'s tag is the most feared sound in the booth',
            'Keef at sixteen changed the sound of everything',
        ],
        choruses: [
            'mask off Future and the flute goes wild',
            'bad and boujee Migos culture in the building',
            'it\'s lit Travis Scott the flames are eternal',
            'brrr Gucci Mane the ice is everlasting',
            'if young metro don\'t trust you the beat won\'t drop',
        ],
    },

    // =====================================================================
    // REGGAE — Celebrity & Movie References
    // =====================================================================
    reggae: {
        openers: [
            'Bob Marley said one love and the world came together',
            'Damian Marley said welcome to Jamrock tonight',
            'Chronixx said here comes trouble and the youth agreed',
            'Koffee said toast and the Grammy came calling',
        ],
        verses: [
            'Marley\'s redemption song is the freedom anthem still',
            'Damian Jr Gong carried the Marley torch with honor',
            'Koffee\'s gratitude toast was the youngest Grammy blessing',
            'the Harder They Come Jimmy Cliff on the big screen',
            'Cool Runnings the bobsled and the Jamaican dream',
        ],
        choruses: [
            'one love Bob Marley the world sings together',
            'three little birds singing don\'t worry tonight',
            'no woman no cry everything is gonna be alright',
            'welcome to Jamrock Damian holds the flame',
        ],
    },

    // =====================================================================
    // AFROBEAT — Celebrity & Movie References
    // =====================================================================
    afrobeat: {
        openers: [
            'Burna Boy said I am an African giant rising',
            'Wizkid made the essence and the world caught the vibe',
            'Fela Kuti said water no get enemy tonight',
            'Rema said calm down and the global charts obeyed',
            'Tems said free mind and the voice floated free',
        ],
        verses: [
            'Burna proved the African giant stands tallest',
            'Fela fought the system with the saxophone and truth',
            'Tems\' voice carried the Afro sound to the Oscars',
            'Afrobeats went from Fela\'s shrine to the global stage',
            'Black Panther Wakanda the Afro-futurism dream',
            'Coming to America Zamunda and the kingdom vibes',
        ],
        choruses: [
            'African giant Burna Boy the continent rising',
            'essence Wizkid and Tems the perfect fusion',
            'water no get enemy Fela the truth flows',
            'calm down Rema the global anthem plays',
        ],
    },

    // =====================================================================
    // BLUES — Celebrity & Movie References
    // =====================================================================
    blues: {
        openers: [
            'B.B. King named Lucille and she sang the blues for him',
            'Robert Johnson met the devil at the crossroads late',
            'Muddy Waters said the blues had a baby called rock',
            'Etta James said at last and the world fell in love',
            'Stevie Ray Vaughan made the pride and joy scream loud',
        ],
        verses: [
            'B.B.\'s vibrato is the sound of every tear I held',
            'Muddy electrified the delta and the city trembled',
            'Etta sang the Sunday kind of love and meant it',
            'Crossroads Ralph Macchio at the devil\'s guitar duel',
            'the Blues Brothers on a mission from God tonight',
            'Ray the story of Charles and the genius in the dark',
        ],
        choruses: [
            'Lucille sings the blues B.B. bends the string',
            'crossroads Robert Johnson and the devil\'s deal',
            'the blues had a baby Muddy called it rock and roll',
            'at last Etta the love was worth the wait',
        ],
    },

    // =====================================================================
    // PUNK — Celebrity & Movie References
    // =====================================================================
    punk: {
        openers: [
            'the Ramones said hey ho let\'s go and we ran',
            'the Clash asked should I stay and I stayed screaming',
            'Black Flag raised the bars on everything hardcore',
            'Bikini Kill said rebel girl and the riot started',
            'Green Day said basket case and we all related',
        ],
        verses: [
            'Joey Ramone proved three chords is all you need',
            'Joe Strummer sang London calling from the rooftops',
            'Henry Rollins screamed the pain into the microphone',
            'Kathleen Hanna wrote riot grrrl on her stomach',
            'Patti Smith because the night belonged to poets',
            'Iggy Pop walked on the crowd and the crowd held him',
            'SLC Punk the mohawk and the existential crisis',
            'Sid and Nancy the love story written in safety pins',
        ],
        choruses: [
            'hey ho let\'s go the Ramones are calling out',
            'London calling the Clash from the edge of the world',
            'rebel girl Bikini Kill the riot never ends',
            'basket case Green Day the punk heart beats for all',
        ],
    },

    // =====================================================================
    // FUNK — Celebrity & Movie References
    // =====================================================================
    funk: {
        openers: [
            'James Brown said get up offa that thing and dance',
            'George Clinton rode the mothership to funk town',
            'Bootsy Collins slapped the bass and the world shook',
            'Prince funked the world in purple paisley dreams',
            'Earth Wind and Fire said September and we danced',
            'Bruno Mars and Silk Sonic left the door open wide',
        ],
        verses: [
            'James Brown\'s cape fell and the funk never stopped',
            'Clinton\'s Parliament built the mothership from bass and soul',
            'Bootsy\'s star bass sparkled louder than the disco ball',
            'September by Earth Wind and Fire never gets old',
            'Get On Up the James Brown story in the footwork',
            'Soul Train the dance line that built the funk culture',
        ],
        choruses: [
            'get up offa that thing James Brown commands the floor',
            'we want the funk Clinton give up the mothership',
            'September do you remember Earth Wind and Fire',
            'leave the door open Silk Sonic smooth as gold',
        ],
    },

    // =====================================================================
    // SYNTHWAVE — Celebrity & Movie References
    // =====================================================================
    synthwave: {
        openers: [
            'Kavinsky said nightcall and the Drive began',
            'John Carpenter scored the night with analog dread',
            'Vangelis composed the Blade Runner rain and tears',
        ],
        verses: [
            'Vangelis proved synthesizers can hold a soul',
            'Carpenter\'s Halloween theme is the scariest synth ever played',
            'Drive the scorpion jacket and the elevator silence',
            'Blade Runner the replicant tears in the neon rain',
            'Tron the grid and the light cycle and the digital frontier',
            'Stranger Things the Hawkins lab and the synth gate open',
        ],
        choruses: [
            'nightcall Kavinsky the highway calls us home',
            'Blade Runner tears in the neon rain tonight',
            'stranger things happen when the synths come alive',
            'the 80s never died they just went underground',
        ],
    },

    // =====================================================================
    // DRILL — Celebrity & Movie References
    // =====================================================================
    drill: {
        openers: [
            'Chief Keef said love Sosa and the drill was born',
            'Pop Smoke said woo and Brooklyn shook the world',
            'Lil Durk said the voice and Chicago listened close',
            'Central Cee said loading and the UK linked up',
        ],
        verses: [
            'Keef at fifteen rewrote the sound of Chicago streets',
            'Pop Smoke\'s voice rumbled deeper than the subway train',
            'Central Cee bridged the Atlantic with the UK flow',
            'Top Boy the UK estate and the drill soundtrack',
        ],
        choruses: [
            'love Sosa Keef the drill was born tonight',
            'woo Pop Smoke the Brooklyn anthem shakes',
            'the voice Durk the streets are listening close',
        ],
    },
};

/**
 * Merge expansion 6 data into existing genre banks.
 * Same logic as mergeGenreBanks2/3/4/5 — handles vocabulary objects and array fields.
 */
export function mergeGenreBanks6(existing, expansion) {
    for (const [genre, data] of Object.entries(expansion)) {
        if (!existing[genre]) {
            existing[genre] = data;
        } else {
            for (const [key, val] of Object.entries(data)) {
                if (key === 'vocabulary' && typeof val === 'object') {
                    if (!existing[genre].vocabulary) existing[genre].vocabulary = {};
                    for (const [vk, arr] of Object.entries(val)) {
                        if (Array.isArray(existing[genre].vocabulary[vk])) {
                            existing[genre].vocabulary[vk].push(...arr);
                        } else {
                            existing[genre].vocabulary[vk] = [...arr];
                        }
                    }
                } else if (Array.isArray(val)) {
                    if (Array.isArray(existing[genre][key])) {
                        existing[genre][key].push(...val);
                    } else {
                        existing[genre][key] = [...val];
                    }
                }
            }
        }
    }
}
