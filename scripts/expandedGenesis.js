/**
 * Fully expanded chapter study content — Bible facts + verse anchors.
 * See CONTENT_RULES.md. Theology appears only via cross-reference module.
 */

export function studyChapter(enSummary, enPoints, afSummary, afPoints) {
    return {
        en: { summary: enSummary, points: enPoints },
        af: { summary: afSummary, points: afPoints },
    };
}

/** @param {{ title: string, verses?: string, detail: string }[]} points */
export const GENESIS_EXPANDED = {
    1: studyChapter(
        `The chapter records God creating the heavens and the earth (v. 1). The earth is first described as formless and empty with darkness over the deep; the Spirit of God moves over the waters (v. 2). Over six days God speaks and creation follows: light separated from darkness (vv. 3–5); sky separating waters (vv. 6–8); dry land, seas, and vegetation (vv. 9–13); sun, moon, and stars (vv. 14–19); sea creatures and birds (vv. 20–23); livestock, creeping things, wild animals, and mankind — male and female — in his image (vv. 24–27). God calls each stage good and mankind very good (v. 31). The account of seventh-day rest continues at the start of chapter 2 (2:2–3).`,
        [
            {
                title: 'Creation by God\'s spoken command',
                verses: 'vv. 3, 6, 9, 11, 14, 20, 24, 26',
                detail:
                    'The text repeatedly records God saying "Let there be…" or "Let the earth bring forth…" and the item appearing. Light (v. 3), the expanse (v. 6), gathered seas and dry land (v. 9), plants (v. 11), heavenly lights (v. 14), sea life and birds (v. 20), land animals (v. 24), and humans (v. 26) each follow a divine word.',
            },
            {
                title: 'God declares creation "good"',
                verses: 'vv. 4, 10, 12, 18, 21, 25, 31',
                detail:
                    'After major stages God sees that it is good (vv. 4, 10, 12, 18, 21, 25). On the sixth day he sees all he made and calls it very good (v. 31). The chapter does not define the word "good" but repeats the evaluation at each step.',
            },
            {
                title: 'Humanity in God\'s image, male and female',
                verses: 'vv. 26–28',
                detail:
                    'God says "Let us make man in our image, after our likeness" (v. 26). They are to be fruitful, multiply, fill the earth, and subdue it; they receive dominion over fish, birds, livestock, and the earth (vv. 26–28). Male and female are both created in his image (v. 27).',
            },
            {
                title: 'Seventh-day rest',
                verses: 'vv. 31–2:3',
                detail:
                    'After six days of making, God rests on the seventh day from all his work (2:2). He blesses the seventh day and makes it holy because he rested (2:3). The chapter ends with this rest, not with more creation.',
            },
        ],
        `Die hoofstuk beskryf dat God die hemel en die aarde geskape het (v. 1). Die aarde is eers formlos en leeg met duisternis oor die watervloed; die Gees van God beweeg oor die waters (v. 2). Oor ses dae spreek God en skepping volg: lig (vv. 3–5); hemelruim (vv. 6–8); droë land, see en plante (vv. 9–13); son, maan en sterre (vv. 14–19); seediere en voëls (vv. 20–23); vee, kruipende diere, wilde diere en die mens — man en vrou — na sy beeld (vv. 24–27). God noem elke stap goed en die mens baie goed (v. 31). Op die sewende dag rus God, seën die dag en heilig dit (2:2–3).`,
        [
            {
                title: 'Skepping deur God se gesproke bevel',
                verses: 'vv. 3, 6, 9, 11, 14, 20, 24, 26',
                detail:
                    'Die teks beskryf herhaaldelik dat God sê "Laat daar wees…" en dit verskyn: lig (v. 3), uitspansel (v. 6), land en see (v. 9), plante (v. 11), hemelliggame (v. 14), seediere en voëls (v. 20), landdiere (v. 24), en mense (v. 26).',
            },
            {
                title: 'God verklaar die skepping "goed"',
                verses: 'vv. 4, 10, 12, 18, 21, 25, 31',
                detail:
                    'Na groot stadia sien God dat dit goed is (vv. 4, 10, 12, 18, 21, 25). Op die sesde dag sien hy alles en noem dit baie goed (v. 31).',
            },
            {
                title: 'Mens na God se beeld, man en vrou',
                verses: 'vv. 26–28',
                detail:
                    'God sê: "Laat ons mens maak na ons beeld" (v. 26). Hulle moet vrugbaar wees, vermeerder, die aarde vul en onderwerping uitoefen (vv. 26–28). Man en vrou is beide na sy beeld geskape (v. 27).',
            },
            {
                title: 'Rus op die sewende dag',
                verses: 'vv. 31–2:3',
                detail:
                    'Na ses dae rus God op die sewende dag van al sy werk (2:2). Hy seën die dag en heilig dit omdat Hy gerus het (2:3).',
            },
        ]
    ),
    2: studyChapter(
        `The heavens and earth are finished (v. 1). On the seventh day God rests and blesses the day (vv. 2–3). The narrative shifts to when God forms the man from the dust of the ground and breathes into his nostrils the breath of life (v. 7). God plants Eden in the east and places the man there (v. 8). Two trees are named: the tree of life and the tree of knowledge of good and evil (v. 9). A river flows from Eden to water the garden and divides into four rivers named Pishon, Gihon, Tigris, and Euphrates (vv. 10–14). God commands the man not to eat from the tree of knowledge of good and evil, warning of death (vv. 16–17). Animals are formed and named by the man; no helper is found (vv. 19–20). God builds the woman from the man's rib; the man calls her "woman" and the text states a man leaves father and mother and holds fast to his wife, becoming one flesh (vv. 21–24). They are naked and not ashamed (v. 25).`,
        [
            {
                title: 'Man formed and given breath',
                verses: 'v. 7',
                detail:
                    'The Lord God forms the man from dust of the ground and breathes into his nostrils the breath of life; the man becomes a living creature. The chapter records both material (dust) and divine breath.',
            },
            {
                title: 'Eden and the two named trees',
                verses: 'vv. 8–9, 16–17',
                detail:
                    'God plants a garden in Eden and puts the man there. The tree of life and the tree of knowledge of good and evil are named. God permits eating from any tree except the tree of knowledge; eating it brings death (vv. 16–17).',
            },
            {
                title: 'Woman formed; one-flesh union stated',
                verses: 'vv. 21–24',
                detail:
                    'God builds a woman from the man\'s rib. The man says she is bone of his bones and flesh of his flesh (v. 23). Verse 24 states a man shall leave father and mother and hold fast to his wife, and they shall become one flesh.',
            },
            {
                title: 'Naked without shame',
                verses: 'v. 25',
                detail:
                    'The chapter ends stating the man and his wife were both naked and were not ashamed — the last recorded condition before chapter 3.',
            },
        ],
        `Die hemel en aarde is voltooi (v. 1). Op die sewende dag rus God (vv. 2–3). Die Here God vorm die man uit stof en blaas lewensasem in sy neus (v. 7). Hy plant Eden in die ooste (v. 8). Twee bome word genoem: lewensboom en boom van kennis (v. 9). 'n Rivier vloei uit Eden en verdeel in vier riviere (vv. 10–14). God verbied die man om van die kennisboom te eet — sterwe sou volg (vv. 16–17). Diere word gevorm en deur die man genoem (vv. 19–20). God bou die vrou uit die man se rib (vv. 21–24). Hulle is naak en nie beskaam nie (v. 25).`,
        [
            {
                title: 'Man gevorm en lewensasem gegee',
                verses: 'v. 7',
                detail:
                    'Die Here God vorm die man uit stof van die grond en blaas lewensasem in sy neus; die man word \'n lewende wese.',
            },
            {
                title: 'Eden en die twee bome',
                verses: 'vv. 8–9, 16–17',
                detail:
                    'God plant \'n tuin in Eden. Die lewensboom en kennisboom word genoem. Eet van die kennisboom bring die dood (vv. 16–17).',
            },
            {
                title: 'Vrou gevorm; een-vlees unie',
                verses: 'vv. 21–24',
                detail:
                    'God bou \'n vrou uit die man se rib. V. 24 sê \'n man sal sy vader en moeder verlaat en sy vrou aankleef, en hulle word een vlees.',
            },
            {
                title: 'Naak sonder skaamte',
                verses: 'v. 25',
                detail:
                    'Die hoofstuk eindig: hulle was beide naak en nie beskaam nie — die laaste toestand voor hoofstuk 3.',
            },
        ]
    ),
    3: studyChapter(
        `The serpent questions whether God forbade eating from any tree (v. 1). The woman repeats God\'s command about the tree in the middle and adds "neither shall you touch it" (vv. 2–3). The serpent denies they will die and says their eyes will open knowing good and evil (vv. 4–5). The woman sees the fruit, takes and eats; she gives to her husband with her and he eats (v. 6). Their eyes open; they know they are naked and sew fig leaves (v. 7). They hide from God among the trees (v. 8). God calls "Where are you?" (v. 9). The man says he hid because he was afraid; he blames the woman God gave him (vv. 10–12). The woman blames the serpent (v. 13). God curses the serpent to crawl and eat dust; enmity between serpent and woman\'s offspring is declared (vv. 14–15). Pain in childbearing and desire toward husband are stated for the woman; rule of husband is stated (v. 16). Ground is cursed for the man; thorns, toil, and sweat until return to dust; death named (vv. 17–19). Garments of skins are made (v. 21). The man is sent out of Eden lest he eat from the tree of life and live forever; cherubim and flaming sword guard the way (vv. 22–24).`,
        [
            {
                title: 'Serpent, fruit eaten, eyes opened',
                verses: 'vv. 1–7',
                detail:
                    'The serpent challenges God\'s command (vv. 1–5). Both eat (v. 6). They know they are naked and make coverings (v. 7). The text records eating before their eyes were "opened" in the sense of v. 7.',
            },
            {
                title: 'Hiding and blame',
                verses: 'vv. 8–13',
                detail:
                    'They hide when God walks in the garden (v. 8). The man blames the woman; the woman blames the serpent (vv. 12–13). God questions each party before pronouncing consequences.',
            },
            {
                title: 'Judgments on serpent, woman, man',
                verses: 'vv. 14–19',
                detail:
                    'Serpent cursed to crawl (v. 14); pain in childbearing (v. 16); ground cursed, thorns and toil (v. 17); return to dust named (v. 19). Each speech records specific consequences.',
            },
            {
                title: 'Expulsion from Eden',
                verses: 'vv. 22–24',
                detail:
                    'God drives the man out and places cherubim and a flaming sword east of Eden to guard the way to the tree of life (vv. 24). The man is sent to work ground cursed outside Eden.',
            },
        ],
        `Die slang vra of God enige boom verbied het (v. 1). Die vrou herhaal die gebod en voeg by dat hulle dit nie mag aanraak nie (vv. 2–3). Die slang sê hulle sal nie sterf nie (vv. 4–5). Sy neem en eet; sy gee aan haar man en hy eet (v. 6). Hulle merk hulle naakheid en maak vygeblare (v. 7). Hulle verberg vir God (v. 8). God roep: "Waar is jy?" (v. 9). Die man skuld die vrou; die vrou skuld die slang (vv. 12–13). God spreek vonnis uit oor slang, vrou en man (vv. 14–19). Velklere word gemaak (v. 21). Hulle word uit Eden verdryf; cherubim bewaak die pad na die lewensboom (vv. 22–24).`,
        [
            {
                title: 'Slang, vrug geëet, oë geopen',
                verses: 'vv. 1–7',
                detail:
                    'Die slang betwiste God se gebod (vv. 1–5). Albei eet (v. 6). Hulle merk naakheid en maak bedekking (v. 7).',
            },
            {
                title: 'Wegsteek en skuld',
                verses: 'vv. 8–13',
                detail:
                    'Hulle verberg wanneer God in die tuin loop (v. 8). Die man skuld die vrou; die vrou die slang (vv. 12–13).',
            },
            {
                title: 'Vonnis op slang, vrou, man',
                verses: 'vv. 14–19',
                detail:
                    'Slang vervloek (v. 14); pyn in geboorte (v. 16); grond vervloek, dorings en sweet (v. 17); terugkeer na stof (v. 19).',
            },
            {
                title: 'Uitsetting uit Eden',
                verses: 'vv. 22–24',
                detail:
                    'God dryf die man uit en plaas cherubim met \'n flammende swaard om die pad na die lewensboom te bewaar (v. 24).',
            },
        ]
    ),
    4: studyChapter(
        `The man knows his wife Eve; Cain is born, then Abel (v. 1–2). Abel keeps sheep; Cain works the ground (v. 2). Both bring offerings; God has regard for Abel and his offering but not for Cain\'s (vv. 3–5). Cain is angry; God warns that sin crouches at the door and he must rule it (vv. 6–7). Cain rises against Abel and kills him in the field (v. 8). God asks where Abel is; Cain says he does not know, "Am I my brother\'s keeper?" (vv. 9–10). Abel\'s blood cries from the ground; Cain is cursed from the ground and becomes a fugitive (vv. 10–12). Cain receives a mark so no one kills him; he builds a city and names it after his son Enoch (vv. 15–17). Cain\'s line lists Lamech who speaks of killing a man (vv. 18–24). Adam and Eve have Seth; people begin calling on the name of the Lord (vv. 25–26).`,
        [
            {
                title: 'Two offerings; Abel accepted, Cain not',
                verses: 'vv. 3–5',
                detail:
                    'Cain brings fruit of the ground; Abel brings firstborn of flock and fat portions (vv. 3–4). God has regard for Abel and his offering but not Cain\'s (v. 5). Cain\'s face falls (v. 5).',
            },
            {
                title: 'Murder in the field',
                verses: 'vv. 6–8',
                detail:
                    'God warns Cain about sin crouching at the door (v. 7). Cain speaks to Abel in the field and kills him when they are alone (v. 8). The text records the first human death by violence.',
            },
            {
                title: 'Cain\'s curse and mark',
                verses: 'vv. 9–15',
                detail:
                    'Cain is cursed from the ground that opened its mouth for Abel\'s blood (v. 11). He becomes a fugitive (v. 12). God sets a mark on Cain so whoever finds him will not kill him (v. 15).',
            },
            {
                title: 'Seth\'s line calls on the Lord',
                verses: 'vv. 25–26',
                detail:
                    'Eve bears Seth, saying God appointed another offspring (v. 25). At that time people begin calling on the name of the Lord (v. 26). The chapter contrasts Cain\'s city line with this statement.',
            },
        ],
        `Die man ken sy vrou Eva; Kain word gebore, dan Abel (vv. 1–2). Abel hou skape; Kain bewerk die grond (v. 2). Beide bring offers; God ag Abel en sy offer maar nie dié van Kain nie (vv. 3–5). Kain is kwaad; God waarsku dat sonde by die deur lê (vv. 6–7). Kain slaan Abel dood in die veld (v. 8). God vra waar Abel is; Kain antwoord hy is nie sy broer se keeper nie (vv. 9–10). Kain is vervloek en kry \'n merk (vv. 11–15). Seth word gebore; mense begin die Naam van die Here aan te roep (vv. 25–26).`,
        [
            {
                title: 'Twee offers; Abel aanvaar, Kain nie',
                verses: 'vv. 3–5',
                detail:
                    'Kain bring vrug van die grond; Abel bring die firstling van die kudde (vv. 3–4). God ag Abel en sy offer, nie dié van Kain nie (v. 5).',
            },
            {
                title: 'Moord in die veld',
                verses: 'vv. 6–8',
                detail:
                    'God waarsku Kain dat sonde by die deur lê (v. 7). Kain maak Abel in die veld dood (v. 8).',
            },
            {
                title: 'Kain se vloek en merk',
                verses: 'vv. 9–15',
                detail:
                    'Kain is vervloek van die grond (v. 11). God merk hom sodat niemand hom sal doodslaan nie (v. 15).',
            },
            {
                title: 'Seth se lyn roep op die Here',
                verses: 'vv. 25–26',
                detail:
                    'Eva baar Seth (v. 25). Mense begin die Naam van die Here aan te roep (v. 26).',
            },
        ]
    ),
};
