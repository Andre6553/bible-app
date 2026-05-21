/**
 * Curated Psalm study content — Bible facts + verse anchors.
 * See CONTENT_RULES.md.
 */

export function studyChapter(enSummary, enPoints, afSummary, afPoints) {
    return {
        en: { summary: enSummary, points: enPoints },
        af: { summary: afSummary, points: afPoints },
    };
}

/** @type {Record<number, ReturnType<typeof studyChapter>>} */
export const PSALMS_EXPANDED = {
    27: studyChapter(
        `David opens by naming the Lord as his light and salvation and asking whom he should fear (v. 1). Enemies and armies may surround him, yet he declares his heart will not fear (vv. 2–3). He asks to dwell in the Lord's house, behold his beauty, and inquire in his temple (v. 4); he describes being hidden in God's shelter and set high on a rock with head lifted above enemies (vv. 5–6). He pleads for God to hear, seeks God's face, and asks not to be forsaken (vv. 7–9). Even if parents forsake him, the Lord will take him in (v. 10). He asks to be taught God's way on a level path and not handed to foes (vv. 11–12). The psalm closes with a call to wait for the Lord, be strong, and let the heart take courage (v. 14).`,
        [
            {
                title: 'Light, salvation, and courage before enemies',
                verses: 'vv. 1–3',
                detail:
                    'David states the Lord is his light and salvation (v. 1). When evildoers assail, adversaries stumble and fall (v. 2). Though an army encamp or war arise, his heart will not fear (v. 3).',
            },
            {
                title: 'One request: dwell in the Lord\'s house',
                verses: 'vv. 4–6',
                detail:
                    `David asks for one thing: to dwell in the Lord's house all his days, to gaze on the Lord's beauty, and to inquire in his temple (v. 4). He will be hidden in God's shelter and set high on a rock (v. 5). He will offer sacrifices with shouts of joy and sing praises (v. 6).`,
            },
            {
                title: 'Seeking God\'s face when others may fail',
                verses: 'vv. 7–10',
                detail:
                    'David cries for the Lord to hear and be merciful (v. 7). His heart says "Seek my face"; he answers, "Your face, Lord, I will seek" (v. 8). He asks God not to hide or reject him in anger (v. 9). If father and mother forsake him, the Lord will take him in (v. 10).',
            },
            {
                title: 'Wait for the Lord — be strong',
                verses: 'vv. 11–14',
                detail:
                    `David asks to be taught the Lord's way and led on a level path because of enemies (vv. 11–12). He urges: wait for the Lord; be strong, and let your heart take courage; wait for the Lord (v. 14).`,
            },
        ],
        `Dawid open met die Here as sy lig en redding — wie moet hy vrees? (v. 1). Vyande en leers mag hom omring, maar sy hart sal nie vrees nie (vv. 2–3). Hy vra om in die Here se huis te woon, sy skoonheid te aanskou en in sy tempel te ondersoek (v. 4); hy beskryf dat hy in God se skuiling versteek en hoog op 'n rots geplaas word (vv. 5–6). Hy smeek dat God sal hoor, soek God se aangesig, en vra om nie verlaat te word nie (vv. 7–9). Selfs as ouers hom verlaat, sal die Here hom aanneem (v. 10). Hy vra om op 'n regte pad gelei te word (vv. 11–12). Die psalm eindig: wag op die Here, wees sterk, en laat jou hart moed neem (v. 14).`,
        [
            {
                title: 'Lig, redding en moed voor vyande',
                verses: 'vv. 1–3',
                detail:
                    `Dawid sê die Here is sy lig en redding (v. 1). Wanneer boosdoeners aanval, struikel teenstanders (v. 2). Al sou 'n leër kampeer of oorlog opkom, sal sy hart nie vrees nie (v. 3).`,
            },
            {
                title: 'Een versoek: woon in die Here se huis',
                verses: 'vv. 4–6',
                detail:
                    `Dawid vra vir een ding: om in die Here se huis te woon, sy skoonheid te aanskou en in sy tempel te ondersoek (v. 4). Hy sal in God se skuiling versteek en hoog op 'n rots geplaas word (v. 5). Hy sal offers bring met vreugde-roepe (v. 6).`,
            },
            {
                title: 'Soek God se aangesig wanneer ander faal',
                verses: 'vv. 7–10',
                detail:
                    'Dawid roep dat die Here sal hoor en genadig wees (v. 7). Sy hart sê "Soek my aangesig"; hy antwoord: "U aangesig, Here, sal ek soek" (v. 8). As vader en moeder hom verlaat, sal die Here hom aanneem (v. 10).',
            },
            {
                title: 'Wag op die Here — wees sterk',
                verses: 'vv. 11–14',
                detail:
                    `Dawid vra om op 'n regte pad gelei te word (vv. 11–12). Hy roep: wag op die Here; wees sterk, en laat jou hart moed neem; wag op die Here (v. 14).`,
            },
        ]
    ),
    37: studyChapter(
        `The psalm instructs not to fret over evildoers who will wither like grass (vv. 1–2). Trust in the Lord, do good, dwell in the land, and feed on his faithfulness (v. 3). Delight in the Lord and he will give the desires of your heart (v. 4). Commit your way to the Lord, trust him, and he will act (v. 5). Be still before the Lord and wait patiently for him (v. 7). Evildoers will be cut off, but those who wait for the Lord will inherit the land (v. 9). The meek will inherit the land and delight in peace (v. 11). The Lord establishes the steps of the righteous; though they fall, they are not cast headlong (vv. 23–24). The psalmist says he has never seen the righteous forsaken (v. 25). Wait for the Lord and keep his way to inherit the land (v. 34). The future of the blameless is peace (v. 37). The salvation of the righteous is from the Lord; he is their refuge in time of trouble (vv. 39–40).`,
        [
            {
                title: 'Do not fret — trust and do good',
                verses: 'vv. 1–3',
                detail:
                    'The psalm opens: do not fret because of evildoers; they will soon fade like grass (vv. 1–2). Trust in the Lord and do good; dwell in the land and feed on his faithfulness (v. 3).',
            },
            {
                title: 'Delight, commit, and wait',
                verses: 'vv. 4–7',
                detail:
                    'Delight yourself in the Lord and he will give the desires of your heart (v. 4). Commit your way to the Lord; trust in him, and he will act (v. 5). Be still before the Lord and wait patiently for him (v. 7).',
            },
            {
                title: 'The meek inherit the land',
                verses: 'vv. 9–11',
                detail:
                    'Evildoers will be cut off, but those who wait for the Lord will inherit the land (v. 9). A little while and the wicked will be no more (v. 10). The meek will inherit the land and delight themselves in abundant peace (v. 11).',
            },
            {
                title: 'The Lord upholds the righteous',
                verses: 'vv. 23–25, 34, 39–40',
                detail:
                    'The steps of a man are established by the Lord; though he fall, he shall not be cast headlong (vv. 23–24). The psalmist has not seen the righteous forsaken (v. 25). Wait for the Lord and keep his way to inherit the land (v. 34). The salvation of the righteous is from the Lord; he helps and delivers them (vv. 39–40).',
            },
        ],
        `Die psalm instrueer om nie oor goddeloses te bekommer nie — hulle verdwyn soos gras (vv. 1–2). Vertrou die Here, doen goed, woon in die land, en voed op sy getrouheid (v. 3). Verlustig jou in die Here en Hy gee die begeertes van jou hart (v. 4). Rol jou pad op die Here, vertrou Hom, en Hy sal handel (v. 5). Wees stil voor die Here en wag geduldig (v. 7). Goddeloses sal afgekap word; wie op die Here wag, erf die land (v. 9). Die sagmoediges erf die land (v. 11). Die Here rig die stappe van die regverdiges op (vv. 23–24). Die skrywer sê hy het die regverdiges nooit verlaat gesien nie (v. 25). Wag op die Here en hou sy pad om die land te erf (v. 34). Die redding van die regverdiges is van die Here (vv. 39–40).`,
        [
            {
                title: 'Moenie bekommer nie — vertrou en doen goed',
                verses: 'vv. 1–3',
                detail:
                    'Moenie oor goddeloses bekommer nie; hulle verdwyn soos gras (vv. 1–2). Vertrou die Here en doen goed; woon in die land en voed op sy getrouheid (v. 3).',
            },
            {
                title: 'Verlustig, rol op, en wag',
                verses: 'vv. 4–7',
                detail:
                    'Verlustig jou in die Here en Hy gee die begeertes van jou hart (v. 4). Rol jou pad op die Here; vertrou Hom, en Hy sal handel (v. 5). Wees stil voor die Here en wag geduldig (v. 7).',
            },
            {
                title: 'Die sagmoediges erf die land',
                verses: 'vv. 9–11',
                detail:
                    'Goddeloses sal afgekap word; wie op die Here wag, erf die land (v. 9). Die sagmoediges erf die land en verlustig hulle in vrede (v. 11).',
            },
            {
                title: 'Die Here onderhou die regverdiges',
                verses: 'vv. 23–25, 34, 39–40',
                detail:
                    `Die stappe van 'n mens word deur die Here reggerig; al val hy, word hy nie neergewerp nie (vv. 23–24). Die skrywer sê hy het die regverdiges nooit verlaat gesien nie (v. 25). Wag op die Here en hou sy pad (v. 34). Die redding van die regverdiges is van die Here (vv. 39–40).`,
            },
        ]
    ),
    46: studyChapter(
        `The psalm opens: God is our refuge and strength, a very present help in trouble (v. 1). Therefore the psalmist will not fear though the earth gives way and mountains fall into the sea (vv. 2–3). A river makes glad the city of God; God is in the midst of her and she shall not be moved (vv. 4–5). Nations rage and kingdoms totter; when God utters his voice the earth melts (vv. 6–7). The Lord of hosts is with us; the God of Jacob is our fortress (v. 7). Come behold the works of the Lord — he makes wars cease to the end of the earth, breaks bow and spear, burns chariots with fire (vv. 8–9). Be still and know that I am God; I will be exalted among the nations (v. 10). The refrain repeats: the Lord of hosts is with us; the God of Jacob is our fortress (v. 11).`,
        [
            {
                title: 'Refuge and strength in trouble',
                verses: 'vv. 1–3',
                detail:
                    'God is our refuge and strength, a very present help in trouble (v. 1). Therefore we will not fear though the earth gives way, mountains slip into the heart of the sea, and waters roar (vv. 2–3).',
            },
            {
                title: 'River, holy city, and God in her midst',
                verses: 'vv. 4–5',
                detail:
                    'There is a river whose streams make glad the city of God, the holy dwelling of the Most High (v. 4). God is in the midst of her; she shall not be moved; God will help her when morning dawns (v. 5).',
            },
            {
                title: 'Nations rage; God speaks',
                verses: 'vv. 6–7',
                detail:
                    'The nations rage and kingdoms totter; God utters his voice and the earth melts (v. 6). The Lord of hosts is with us; the God of Jacob is our fortress (v. 7).',
            },
            {
                title: 'Wars cease; be still and know',
                verses: 'vv. 8–11',
                detail:
                    'Come, behold the works of the Lord: he makes wars cease, breaks the bow, shatters the spear, burns chariots with fire (vv. 8–9). "Be still, and know that I am God; I will be exalted among the nations" (v. 10). The refrain closes the psalm: the Lord of hosts is with us; the God of Jacob is our fortress (v. 11).',
            },
        ],
        `Die psalm open: God is ons toevlug en krag, 'n baie teenwoordige hulp in nood (v. 1). Daarom sal die psalmis nie vrees nie al wankel die aarde en berge in die see val (vv. 2–3). 'n Rivier verbly die stad van God; God is in haar midde en sy sal nie wankel nie (vv. 4–5). Nasies woed en koninkryke wankel; wanneer God sy stem laat hoor, smelt die aarde (vv. 6–7). Die Here van leërskare is met ons; die God van Jakob is ons vesting (v. 7). Kom sien die werke van die Here — Hy laat oorloë ophou, breek boog en spies (vv. 8–9). "Wees stil en weet dat Ek God is" (v. 10). Die refrein herhaal: die Here van leërskare is met ons (v. 11).`,
        [
            {
                title: 'Toevlug en krag in nood',
                verses: 'vv. 1–3',
                detail:
                    `God is ons toevlug en krag, 'n baie teenwoordige hulp in nood (v. 1). Daarom sal ons nie vrees nie al wankel die aarde en berge in die see val (vv. 2–3).`,
            },
            {
                title: 'Rivier, heilige stad, en God in haar midde',
                verses: 'vv. 4–5',
                detail:
                    `Daar is 'n rivier wat die stad van God verbly, die heilige woning van die Allerhoogste (v. 4). God is in haar midde; sy sal nie wankel nie; God sal haar help wanneer môre aanbreek (v. 5).`,
            },
            {
                title: 'Nasies woed; God spreek',
                verses: 'vv. 6–7',
                detail:
                    'Die nasies woed en koninkryke wankel; God laat sy stem hoor en die aarde smelt (v. 6). Die Here van leërskare is met ons; die God van Jakob is ons vesting (v. 7).',
            },
            {
                title: 'Oorloë hou op; wees stil en weet',
                verses: 'vv. 8–11',
                detail:
                    'Kom sien die werke van die Here: Hy laat oorloë ophou, breek die boog, verniel die spies, verbrand strydwagens (vv. 8–9). "Wees stil en weet dat Ek God is" (v. 10). Die refrein sluit die psalm: die Here van leërskare is met ons (v. 11).',
            },
        ]
    ),
};
