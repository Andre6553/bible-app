/**
 * Chapter-by-chapter study summaries for reading plan commentary.
 * Curated outlines for key books; smart fallbacks for all others.
 */

import { GENESIS_EXPANDED } from './expandedGenesis.js';
import { PSALMS_EXPANDED } from './expandedPsalms.js';
import { enrichSummary, normalizeStudyContent } from './studyPointExpansion.js';
import { getCrossReferences, localizeCrossReferences } from './bibleCrossReferences.js';
import { getChapterTeaching } from './chapterTeaching.js';

const BOOKS = {
    1: { name: 'Genesis', name_af: 'Genesis' },
    2: { name: 'Exodus', name_af: 'Eksodus' },
    3: { name: 'Leviticus', name_af: 'Levitikus' },
    4: { name: 'Numbers', name_af: 'Numeri' },
    5: { name: 'Deuteronomy', name_af: 'Deuteronomium' },
    6: { name: 'Joshua', name_af: 'Josua' },
    7: { name: 'Judges', name_af: 'Rigters' },
    8: { name: 'Ruth', name_af: 'Rut' },
    9: { name: '1 Samuel', name_af: '1 Samuel' },
    10: { name: '2 Samuel', name_af: '2 Samuel' },
    11: { name: '1 Kings', name_af: '1 Konings' },
    12: { name: '2 Kings', name_af: '2 Konings' },
    13: { name: '1 Chronicles', name_af: '1 Kronieke' },
    14: { name: '2 Chronicles', name_af: '2 Kronieke' },
    15: { name: 'Ezra', name_af: 'Esra' },
    16: { name: 'Nehemiah', name_af: 'Nehemia' },
    17: { name: 'Esther', name_af: 'Ester' },
    18: { name: 'Job', name_af: 'Job' },
    19: { name: 'Psalms', name_af: 'Psalms' },
    20: { name: 'Proverbs', name_af: 'Spreuke' },
    21: { name: 'Ecclesiastes', name_af: 'Prediker' },
    22: { name: 'Song of Solomon', name_af: 'Hooglied' },
    23: { name: 'Isaiah', name_af: 'Jesaja' },
    24: { name: 'Jeremiah', name_af: 'Jeremia' },
    25: { name: 'Lamentations', name_af: 'Klaagliedere' },
    26: { name: 'Ezekiel', name_af: 'Esegiël' },
    27: { name: 'Daniel', name_af: 'Daniël' },
    28: { name: 'Hosea', name_af: 'Hosea' },
    29: { name: 'Joel', name_af: 'Joël' },
    30: { name: 'Amos', name_af: 'Amos' },
    31: { name: 'Obadiah', name_af: 'Obadja' },
    32: { name: 'Jonah', name_af: 'Jona' },
    33: { name: 'Micah', name_af: 'Miga' },
    34: { name: 'Nahum', name_af: 'Nahum' },
    35: { name: 'Habakkuk', name_af: 'Habakuk' },
    36: { name: 'Zephaniah', name_af: 'Sefanja' },
    37: { name: 'Haggai', name_af: 'Haggai' },
    38: { name: 'Zechariah', name_af: 'Sagaria' },
    39: { name: 'Malachi', name_af: 'Maleagi' },
    40: { name: 'Matthew', name_af: 'Matteus' },
    41: { name: 'Mark', name_af: 'Markus' },
    42: { name: 'Luke', name_af: 'Lukas' },
    43: { name: 'John', name_af: 'Johannes' },
    44: { name: 'Acts', name_af: 'Handelinge' },
    45: { name: 'Romans', name_af: 'Romeine' },
    46: { name: '1 Corinthians', name_af: '1 Korintiërs' },
    47: { name: '2 Corinthians', name_af: '2 Korintiërs' },
    48: { name: 'Galatians', name_af: 'Galasiërs' },
    49: { name: 'Ephesians', name_af: 'Efesiërs' },
    50: { name: 'Philippians', name_af: 'Filippense' },
    51: { name: 'Colossians', name_af: 'Kolossense' },
    52: { name: '1 Thessalonians', name_af: '1 Tessalonisense' },
    53: { name: '2 Thessalonians', name_af: '2 Tessalonisense' },
    54: { name: '1 Timothy', name_af: '1 Timoteus' },
    55: { name: '2 Timothy', name_af: '2 Timoteus' },
    56: { name: 'Titus', name_af: 'Titus' },
    57: { name: 'Philemon', name_af: 'Filemon' },
    58: { name: 'Hebrews', name_af: 'Hebreërs' },
    59: { name: 'James', name_af: 'Jakobus' },
    60: { name: '1 Peter', name_af: '1 Petrus' },
    61: { name: '2 Peter', name_af: '2 Petrus' },
    62: { name: '1 John', name_af: '1 Johannes' },
    63: { name: '2 John', name_af: '2 Johannes' },
    64: { name: '3 John', name_af: '3 Johannes' },
    65: { name: 'Jude', name_af: 'Judas' },
    66: { name: 'Revelation', name_af: 'Openbaring' },
};

/** @type {Record<string, { en: ChapterContent, af: ChapterContent }>} */
const CURATED = {};

function chapter(enSummary, enHighlights, afSummary, afHighlights) {
    return {
        en: { summary: enSummary, highlights: enHighlights },
        af: { summary: afSummary, highlights: afHighlights },
    };
}

function add(id, ch, data) {
    CURATED[`${id}:${ch}`] = data;
}

// Genesis 1–11 (creation to Babel)
const GENESIS_EARLY = [
    chapter(
        'God creates the heavens, earth, and all life in six days and rests on the seventh. Light, land, plants, stars, animals, and humanity are declared good. Man and woman are made in God\'s image with dominion over creation.',
        ['God creates by His word', 'Repeated refrain: "it was good"', 'Humanity bears God\'s image', 'Sabbath rest on the seventh day'],
        'God skep die hemel, aarde en all lewe in ses dae en rus op die sewende. Lig, land, plante, sterre, diere en die mens word goed verklaar. Man en vrou is na God se beeld gemaak met heerskappy oor die skepping.',
        ['God skep deur Sy woord', 'Herhaalde refrein: "dit was goed"', 'Die mens dra God se beeld', 'Sabbatrus op die sewende dag']
    ),
    chapter(
        'God forms Adam from the dust, plants Eden, and gives one command. Adam names the animals; Eve is created as a helper. Marriage is instituted and they live naked without shame.',
        ['Eden as place of fellowship with God', 'The tree of knowledge — one boundary', 'Marriage: one flesh partnership', 'Work and stewardship in the garden'],
        'God vorm Adam uit stof, plant Eden en gee een gebod. Adam noem die diere; Eva word as helper geskape. Huwelik word ingestel en hulle leef naak sonder skaamte.',
        ['Eden as plek van gemeenskap met God', 'Die boom van kennis — een grens', 'Huwelik: een-vlees vennootskap', 'Werk en versorging in die tuin']
    ),
    chapter(
        'The serpent deceives Eve; both eat the forbidden fruit. Shame, blame, and broken relationships follow. God pronounces judgment but also promises a future redeemer (seed of the woman).',
        ['The fall: doubt, desire, disobedience', 'Broken trust between God and people', 'Pain in childbirth and toil in work', 'First gospel hint: enmity with the serpent'],
        'Die slang mislei Eva; albei eet die verbode vrug. Skaamte, skuld en gebroke verhoudings volg. God spreek vonnis uit maar beloof ook \'n toekomstige Verlosser (saad van die vrou).',
        ['Die val: twyfel, begeerte, ongehoorsaamheid', 'Gebroke vertroue tussen God en mense', 'Pyn in geboorte en swaarkry in werk', 'Eerste evangelie-hint: vyandskap met die slang']
    ),
    chapter(
        'Cain murders Abel out of jealousy; God marks Cain but exiles him. Cain\'s line develops culture; Seth\'s line calls on the Lord. Sin spreads but God preserves a faithful line.',
        ['Jealous worship leads to murder', 'God cares even for the guilty (Cain\'s mark)', 'Two lines: civilization vs. calling on God', 'Sin crouches — mastery is possible'],
        'Kain moor Abel uit jaloesie; God merk Kain maar verban hom. Kain se lyn ontwikkel kultuur; Seth se lyn roep op die Here. Sonde versprei maar God bewaar \'n getroue lyn.',
        ['Jaloezie-erediens lei tot moord', 'God gee om selfs vir die skuldige (Kain se merk)', 'Twee lyne: beskawing vs. roep op God', 'Sonde lê op die loer — bemeestering is moontlik']
    ),
    chapter(
        'The godly line from Seth to Noah; long lifespans. Wickedness fills the earth. Enoch walks with God and is taken. Noah is born with hope that comfort will come from the curse.',
        ['Genealogy links Adam to Noah', 'Enoch: extraordinary faith — walks with God', 'Human evil grieves God\'s heart', 'Noah named for future relief'],
        'Die godvrugtige lyn van Seth tot Noag; lank lewensduur. Wickedheid vul die aarde. Enog loop met God en word weggeneem. Noag word gebore met hoop dat troos uit die vloek sal kom.',
        ['Genealogie verbind Adam met Noag', 'Enog: buitengewone geloof — loop met God', 'Menslike boosheid bedroef God se hart', 'Noag genoem vir toekomstige verligting']
    ),
    chapter(
        'God commands Noah to build an ark; Noah obeys. Pairs of animals enter; the flood destroys the earth. Only Noah\'s family and the ark survive — judgment and grace together.',
        ['Total corruption warrants judgment', 'Noah finds favor through faith and obedience', 'The ark: salvation through God\'s provision', 'Forty days of rain — a new beginning'],
        'God beveel Noag om \'n ark te bou; Noag gehoorsaam. Dierepare gaan in; die vloed vernietig die aarde. Net Noag se gesin en die ark oorleef — vonnis en genade saam.',
        ['Totale verdorwenheid regverdig vonnis', 'Noag vind genade deur geloof en gehoorsaamheid', 'Die ark: redding deur God se voorsiening', 'Veertig dae reën — \'n nuwe begin']
    ),
    chapter(
        'Waters recede; Noah exits the ark and worships. God establishes the Noahic covenant — never again a flood. The rainbow signs His promise; Noah plants a vineyard.',
        ['Burnt offering — worship after deliverance', 'Covenant with all creation', 'Rainbow as sign of mercy', 'Human responsibility continues after judgment'],
        'Waters sak; Noag gaan uit die ark en aanbid. God stel die Noagiese verbond — nooit weer \'n vloed. Die reënboog teken Sy belofte; Noag plant \'n wingerd.',
        ['Brandoffer — aanbidding na bevryding', 'Verbond met die hele skepping', 'Reënboog as teken van barmhartigheid', 'Menslike verantwoordelikheid gaan voort na vonnis']
    ),
    chapter(
        'Noah\'s sin and Ham\'s dishonor; Noah prophesies over his sons. Nations descend from Shem, Ham, and Japheth — the table of peoples begins.',
        ['Even the saved remain fallen', 'Honor and dishonor within families', 'Shem\'s line leads toward Abraham', 'Nations spread across the earth'],
        'Noag se sonde en Ham se oneer; Noag profeteer oor sy seuns. Nasies spruit uit Sem, Ham en Jafet — die tabel van volke begin.',
        ['Selfs die geredes bly gevallenes', 'Eer en oneer binne gesinne', 'Sem se lyn lei na Abraham', 'Nasies versprei oor die aarde']
    ),
    chapter(
        'Humanity unites to build a tower to make a name for themselves. God confuses their language and scatters them. Babel explains diverse languages; pride is judged.',
        ['Unity apart from God leads to rebellion', 'Self-glory replaces God\'s glory', 'Languages divided — scattering', 'From Babel to Abram: God\'s plan continues'],
        'Die mensheid verenig om \'n toring te bou vir eie roem. God verwar hul taal en versprei hulle. Babel verduidelik diverse tale; hoogmoed word beoordeel.',
        ['Eenheid sonder God lei tot rebelle', 'Self-roem vervang God se heerlikheid', 'Tale verdeel — verspreiding', 'Van Babel na Abram: God se plan gaan voort']
    ),
    chapter(
        'Genealogy from Shem to Abram. Terah moves toward Canaan; Abram is called. The stage is set for God\'s covenant with Abraham and the promise to bless all nations.',
        ['Shem\'s line preserved through generations', 'Ur to Haran to Canaan — a journey of faith', 'Abram appears at the end of the list', 'Transition from primeval history to patriarchs'],
        'Genealogie van Sem tot Abram. Terah beweeg na Kanaän; Abram word geroep. Die verhoog word gereed vir God se verbond met Abraham en die belofte om alle nasies te seën.',
        ['Sem se lyn bewaar deur geslagte', 'Ur na Haran na Kanaän — \'n reis van geloof', 'Abram verskyn aan die einde van die lys', 'Oorgang van vroegste geskiedenis na patriarge']
    ),
    chapter(
        'God calls Abram to leave his country; Abram obeys. In Canaan God promises the land to his offspring. Abram builds altars; famine drives him to Egypt where he fails but God protects.',
        ['The call: go to a land I will show you', 'Promise of blessing and a great nation', 'Altars mark places of worship', 'Fear in Egypt — yet God preserves the promise'],
        'God roep Abram om sy land te verlaat; Abram gehoorsaam. In Kanaän beloof God die land aan sy nageslag. Abram bou altare; hongersnood dryf hom na Egipte waar hy faal maar God beskerm.',
        ['Die roeping: ga na \'n land wat Ek sal wys', 'Belofte van seën en \'n groot nasie', 'Altare merk plekke van aanbidding', 'Vrees in Egipte — tog bewaar God die belofte']
    ),
];

GENESIS_EARLY.forEach((data, i) => add(1, i + 1, data));

Object.entries(GENESIS_EXPANDED).forEach(([ch, data]) => {
    add(1, Number(ch), data);
});

Object.entries(PSALMS_EXPANDED).forEach(([ch, data]) => {
    add(19, Number(ch), data);
});

// Genesis 12–50 — narrative summaries (condensed but substantive)
const GENESIS_PATRIARCHS = [
    [12, 'Abram and Lot separate; Abram rescues Lot; Melchizedek blesses; God\'s covenant confirmed.', 'Abram en Lot skei; Abram red Lot; Melchisedek seën; God se verbond bevestig.'],
    [13, 'Lot chooses the Jordan plain; Abram dwells in Canaan; God expands the land promise.', 'Lot kies die Jordaanvlakte; Abram woon in Kanaän; God brei die landbelofte uit.'],
    [14, 'War of kings; Abram defeats them and frees Lot; refuses spoils; blessed by Melchizedek.', 'Oorlog van konings; Abram verslaan hulle en bevry Lot; weier buit; deur Melchisedek geseën.'],
    [15, 'God cuts covenant with Abram; stars promise countless descendants; faith credited as righteousness.', 'God sluit verbond met Abram; sterre beloof ontelbare nageslag; geloof as geregtigheid gereken.'],
    [16, 'Sarai gives Hagar to Abram; Ishmael born; Hagar flees; angel promises Ishmael\'s future.', 'Sarai gee Hagar aan Abram; Ismael gebore; Hagar vlug; engel beloof Ismael se toekoms.'],
    [17, 'Covenant of circumcision; Abram renamed Abraham; Sarah promised a son; Isaac foretold.', 'Verbond van besnydenis; Abram hernoem Abraham; Sara beloof \'n seun; Isak voorspel.'],
    [18, 'Three visitors; Sarah promised a son; Abraham intercedes for Sodom.', 'Drie besoekers; Sara beloof \'n seun; Abraham tree namens Sodom in.'],
    [19, 'Angels rescue Lot from Sodom; judgment on the cities; Lot\'s daughters.', 'Engele red Lot uit Sodom; vonnis op die stede; Lot se dogters.'],
    [20, 'Abraham in Gerar; Abimelech; God protects Sarah and keeps the promise alive.', 'Abraham in Gerar; Abimelech; God beskerm Sara en hou die belofte lewend.'],
    [21, 'Isaac born; Hagar and Ishmael sent away; treaty at Beersheba.', 'Isak gebore; Hagar en Ismael weggestuur; verdrag by Bersheba.'],
    [22, 'Abraham tested — offers Isaac; angel stops him; ram provided; covenant reaffirmed.', 'Abraham getoets — offer Isak; engel keer hom; ram voorsien; verbond bekragtig.'],
    [23, 'Sarah dies; Abraham buys Machpelah cave — first foothold in the promised land.', 'Sara sterf; Abraham koop die Makpela-grot — eerste voet aan die grond in die beloofde land.'],
    [24, 'Servant sent to find Isaac a wife; Rebekah chosen; faithful prayer answered.', 'Dienskneg gestuur om vrou vir Isak te vind; Rebekka gekies; getroue gebed beantwoord.'],
    [25, 'Abraham dies; Esau and Jacob born; birthright sold for stew.', 'Abraham sterf; Esau en Jakob gebore; geboorte reg verkoop vir bredie.'],
    [26, 'Isaac in Gerar; wells dug; God confirms Abraham\'s covenant with Isaac.', 'Isak in Gerar; putte gegrawe; God bevestig Abraham se verbond met Isak.'],
    [27, 'Jacob steals blessing through deception; Esau angry; Jacob flees.', 'Jakob steel seën deur bedrog; Esau kwaad; Jakob vlug.'],
    [28, 'Jacob\'s ladder dream at Bethel; God renews the promise; Jacob vows.', 'Jakob se leer-droom by Betel; God hernu die belofte; Jakob maak gelofte.'],
    [29, 'Jacob serves Laban; Leah and Rachel; rivalry and children born.', 'Jakob dien Laban; Lea en Rachel; rivaliteit en kinders gebore.'],
    [30, 'More children through maids; Jacob\'s flocks prosper by God\'s hand.', 'Meer kinders deur diensmeisies; Jakob se kuddes floreer deur God se hand.'],
    [31, 'Jacob flees Laban; covenant at Mizpah; angels meet him.', 'Jakob vlug van Laban; verbond by Mispa; engele ontmoet hom.'],
    [32, 'Jacob prepares to meet Esau; wrestles with God; renamed Israel.', 'Jakob berei ontmoeting met Esau; stry met God; hernoem Israel.'],
    [33, 'Reconciliation with Esau; Jacob settles in Shechem.', 'Versoening met Esau; Jakob vestig by Sikem.'],
    [34, 'Dinah violated; Simeon and Levi\'s violent revenge.', 'Dina skend; Simeon en Levi se gewelddadige wraak.'],
    [35, 'God tells Jacob to go to Bethel; Rachel dies; Isaac dies.', 'God sê Jakob moet Betel toe gaan; Rachel sterf; Isak sterf.'],
    [36, 'Esau\'s genealogy — Edomites; nations from Esau.', 'Esau se genealogie — Edomiete; nasies uit Esau.'],
    [37, 'Joseph\'s dreams; brothers\' jealousy; sold into Egypt.', 'Josef se drome; broers se jaloesie; in Egipte verkoop.'],
    [38, 'Judah and Tamar — messy grace in the messianic line.', 'Juda en Tamar — messy genade in die messias-lyn.'],
    [39, 'Joseph in Potiphar\'s house; resists temptation; falsely imprisoned.', 'Josef in Potifar se huis; weerstaan verleiding; valslik gevangenis.'],
    [40, 'Dreams of cupbearer and baker; Joseph interprets in prison.', 'Drome van drinkbeker en bakker; Josef interpreteer in tronk.'],
    [41, 'Pharaoh\'s dreams; Joseph made ruler; famine preparation.', 'Farao se drome; Josef aangestel as heerser; hongersnood-voorbereiding.'],
    [42, 'Brothers come to Egypt; Joseph tests them; Simeon held.', 'Broers kom Egipte toe; Josef toets hulle; Simeon agtergelaat.'],
    [43, 'Second journey; Benjamin brought; feast with Joseph.', 'Tweede reis; Benjamin saamgebring; feesmaal met Josef.'],
    [44, 'Silver cup planted; Judah offers himself for Benjamin.', 'Silwerbeker geplant; Juda bied hom vir Benjamin aan.'],
    [45, 'Joseph reveals himself; weeps; sends for Jacob — reconciliation begins.', 'Josef openbaar homself; huil; stuur vir Jakob — versoening begin.'],
    [46, 'Jacob\'s family goes to Egypt; seventy souls; God speaks at Beersheba.', 'Jakob se gesin gaan Egipte toe; sewentig siele; God praat by Bersheba.'],
    [47, 'Joseph sustains Egypt and his family; Jacob blesses Pharaoh.', 'Josef onderhou Egipte en sy gesin; Jakob seën Farao.'],
    [48, 'Jacob blesses Ephraim and Manasseh; younger placed above older.', 'Jakob seën Efraim en Manasse; jonger bo die ouer geplaas.'],
    [49, 'Jacob blesses his twelve sons — prophecies over each tribe.', 'Jakob seën sy twaalf seuns — profesieë oor elke stam.'],
    [50, 'Joseph forgives brothers; Jacob buried; Joseph dies with hope of exodus.', 'Josef vergewe broers; Jakob begrawe; Josef sterf met hoop op uitgang.'],
];

GENESIS_PATRIARCHS.forEach(([ch, en, af]) => {
    add(1, ch, chapter(
        en,
        ['Key events in God\'s covenant story', 'Watch how promises survive human failure', 'Note worship, obedience, and grace'],
        af,
        ['Sleutelgebeure in God se verbondverhaal', 'Let hoe beloftes menslike mislukking oorleef', 'Let op aanbidding, gehoorsaamheid en genade']
    ));
});

// Proverbs 1–31
const PROVERBS_THEMES = [
    ['Purpose of Proverbs: wisdom, discipline, and fear of the Lord.', 'Doel van Spreuke: wysheid, dissipline en vrees vir die Here.'],
    ['Seek wisdom like treasure; moral protection from evil paths.', 'Soek wysheid soos skat; morele beskerming van bose paaie.'],
    ['Trust the Lord, not your own understanding; honor with wealth.', 'Vertrou die Here, nie jou eie insig; eer met rykdom.'],
    ['Father\'s instruction: get wisdom; avoid the wicked way.', 'Vader se onderrig: kry wysheid; vermy die goddelose pad.'],
    ['Warning against adultery; consequences of sin.', 'Waarskuwing teen egbreuk; gevolge van sonde.'],
    ['Six things the Lord hates; keep commands like treasure.', 'Ses dinge wat die Here haat; hou gebooie soos skat.'],
    ['Wisdom calls in the streets; those who reject her face ruin.', 'Wysheid roep in strate; wie haar verwerp, staan ondergang te wag.'],
    ['Wisdom\'s value surpasses silver; she was with God at creation.', 'Wysheid se waarde oortref silwer; sy was by God by die skepping.'],
    ['Wisdom builds her house; folly invites to death.', 'Wysheid bou haar huis; dwaasheid nooi na die dood.'],
    ['Righteous speech vs. wicked mouth; diligent hands bring wealth.', 'Regverdige spraak vs. goddelose mond; ywerige hande bring rykdom.'],
    ['Honest scales; pride before destruction; gossip like choice food.', 'Eerlike weegskaal; hoogmoed voor vernietiging; klets soos lekker kos.'],
    ['Love discipline; righteous care for animals; diligent plowing.', 'Hou van dissipline; regverdig omgee vir diere; ywerige ploeg.'],
    ['Walk with the wise; leave an inheritance; discipline your children.', 'Loop met die wyse; los erfenis na; disiplineer jou kinders.'],
    ['Wisdom builds a house; mocker seeks wisdom in vain.', 'Wysheid bou \'n huis; spotter soek wysheid tevergeefs.'],
    ['A gentle answer turns away wrath; the Lord watches evil and good.', '\'n Sagte antwoord keer toorn; die Here sien kwaad en goed.'],
    ['Plans commit to the Lord; kings rule by justice; honest scales.', 'Planne rol op die Here; konings regeer met geregtigheid; eerlike weegskaal.'],
    ['Better a dry crust with peace; God tests hearts; children\'s folly.', 'Beter droë brood met vrede; God toets harte; kinders se dwaasheid.'],
    ['The name of the Lord is a strong tower; death and life in the tongue.', 'Die Naam van die Here is \'n sterk toring; dood en lewe in die tong.'],
    ['Wine mocks; lazy hands make poverty; discipline your son.', 'Wyn bespot; lui hande bring armoede; disiplineer jou seun.'],
    ['Kings detest evil; honest weights; plans succeed with counsel.', 'Konings verfoei kwaad; eerlike gewigte; planne slaag met raad.'],
    ['The Lord weighs hearts; better righteousness than sacrifice.', 'Die Here weeg harte; beter geregtigheid as offer.'],
    ['Train a child in the way; lazy borrow; generous blessed.', 'Lei \'n kind op die pad; lui leen; gulle geseën.'],
    ['Do not envy sinners; fear the Lord all day; guide your heart.', 'Moenie sondaars beny nie; vrees die Here heel dag; lei jou hart.'],
    ['Do not join wicked; wisdom builds; a little sleep — poverty.', 'Moenie by goddeloses aansluit; wysheid bou; bietjie slaap — armoede.'],
    ['Do not boast about tomorrow; faithful wounds of a friend.', 'Moenie roem oor môre; getroue wonde van \'n vriend.'],
    ['Answer not a fool; lazy sluggard; quarrelsome wife.', 'Antwoord nie \'n dwaas; lui traag; stryerige vrou.'],
    ['Do not boast in tomorrow; open rebuke; iron sharpens iron.', 'Moenie roem oor môre; oop berisping; yster skerp yster.'],
    ['The wicked flee with no pursuer; no wisdom in partiality.', 'Die goddelose vlug sonder agtervolger; geen wysheid in partyskap.'],
    ['When the righteous thrive; discipline gives wisdom; no vision — people perish.', 'Wanneer regverdiges floreer; disipline gee wysheid; geen visie — volk vergaan.'],
    ['Agur\'s oracle: humility; every word of God proves true.', 'Agur se uitspraak: nederigheid; elke woord van God is waar.'],
    ['The virtuous wife — Proverbs 31 woman; wisdom in homemaking and business.', 'Die deugsame vrou — Spr 31 vrou; wysheid in huis en besigheid.'],
];

PROVERBS_THEMES.forEach(([en, af], i) => {
    add(20, i + 1, chapter(
        en,
        ['Practical wisdom for daily choices', 'Fear of the Lord as foundation', 'One principle to practice today'],
        af,
        ['Praktiese wysheid vir daaglikse keuses', 'Vrees vir die Here as fondament', 'Een beginsel om vandag te oefen']
    ));
});

// Key chapters (expanded curated notes)
const KEY = {
    '43:1': chapter(
        'John opens with the eternal Word — Jesus as Creator and Light. John the Baptist prepares the way; Jesus calls the first disciples.',
        ['In the beginning was the Word', 'Light shines in darkness', 'Come and see'],
        'Johannes open met die ewige Woord — Jesus as Skepper en Lig. Johannes die Doper berei die pad; Jesus roep die eerste dissipels.',
        ['In die begin was die Woord', 'Lig skyn in duisternis', 'Kom en sien']
    ),
    '43:3': chapter(
        'Nicodemus visits by night; Jesus teaches born-again necessity. John 3:16 declares God\'s love and eternal life through the Son.',
        ['You must be born again', 'God so loved the world', 'Light vs. darkness'],
        'Nikodemus besoek snags; Jesus leer wedergeboorte-noodsaaklikheid. Johannes 3:16 verklaar God se liefde en ewige lewe deur die Seun.',
        ['Jy moet weergebore word', 'God so liefde die wêreld gehad het', 'Lig vs. duisternis']
    ),
    '45:1': chapter(
        'Paul introduces the gospel as God\'s power for salvation. Humanity\'s universal sin; righteousness revealed apart from law.',
        ['The gospel is God\'s power', 'None righteous, no not one', 'Righteousness through faith'],
        'Paul stel die evangelie voor as God se krag vir redding. Mensdom se universele sonde; geregtigheid openbaar buite die wet.',
        ['Die evangelie is God se krag', 'Geen regverdiges, selfs nie een nie', 'Geregtigheid deur geloof']
    ),
    '45:8': chapter(
        'No condemnation for those in Christ. Life in the Spirit vs. flesh. All things work together; nothing separates from God\'s love.',
        ['No condemnation in Christ', 'Spirit gives life', 'Nothing can separate us from love'],
        'Geen veroordeling vir die wat in Christus is. Lewe in die Gees vs. vlees. Alles werk saam; niks skei van God se liefde.',
        ['Geen veroordeling in Christus', 'Gees gee lewe', 'Niks kan ons van liefde skei']
    ),
    '19:23': chapter(
        'The Lord is my shepherd — provision, guidance, protection, and dwelling in God\'s house forever.',
        ['The Lord shepherds me', 'Valley of shadow — fear no evil', 'Goodness and mercy follow'],
        'Die Here is my Herder — voorsiening, leiding, beskerming en woning in God se huis vir altyd.',
        ['Die Here weid my', 'Skaduwee-vallei — geen vrees', 'Goedertierenheid en barmhartigheid volg']
    ),
    '40:5': chapter(
        'The Sermon on the Mount begins — Beatitudes, salt and light, fulfillment of the Law, anger, lust, oaths, enemies.',
        ['Kingdom values invert worldly success', 'Blessed are the poor in spirit', 'Love your enemies'],
        'Die Bergprediking begin — Saligprekings, sout en lig, vervulling van die Wet, toorn, begeerte, eede, vyande.',
        ['Koninkryk-waardes keer wêreldse sukses om', 'Salig die armes van gees', 'Lieft jou vyande']
    ),
    '44:2': chapter(
        'Pentecost — Holy Spirit fills believers; Peter preaches; three thousand saved. The church is born in power.',
        ['Spirit like tongues of fire', 'Peter\'s sermon — crucified and risen', 'Repent and be baptized'],
        'Pinkster — Heilige Gees vul gelowiges; Petrus preek; drieduisend gered. Die kerk word in krag gebore.',
        ['Gees soos vuurtong', 'Petrus se preek — gekruisig en opgestaan', 'Bekeer en doop']
    ),
};

Object.entries(KEY).forEach(([key, data]) => {
    CURATED[key] = data;
});

const CATEGORY_FALLBACK = {
    pentateuch: {
        en: {
            summary: 'This chapter belongs to the Pentateuch — the foundational five books that record God creating, calling, and forming a covenant people. Read it as historical narrative woven with theology: notice what God says directly, what he promises or commands, what the people (or patriarchs) do in response, and what consequence — blessing or judgment — follows. The rest of Scripture quotes and builds on these chapters, so even small details of obedience, faith, or failure are loaded with significance.',
            highlights: ['Covenant promises and commands', 'Human response (faith or failure)', 'God\'s faithfulness across generations'],
        },
        af: {
            summary: 'Hierdie hoofstuk behoort aan die Pentateug — die vyf grondleggende boeke wat beskryf hoe God \'n verbondsvolk skep, roep en vorm. Lees dit as historiese verhaal verweef met teologie: let op wat God direk sê, wat Hy beloof of beveel, wat die volk in reaksie doen, en watter gevolg volg. Die res van die Skrif bou op hierdie hoofstukke.',
            highlights: ['Verbondbeloftes en gebooie', 'Menslike reaksie (geloof of mislukking)', 'God se getrouheid oor geslagte'],
        },
    },
    history: {
        en: {
            summary: 'This is OT historical narrative — the recorded story of how Israel, her leaders, and her neighbours actually walked with God or turned from him, and what happened as a result. The writer is not just chronicling events but showing God\'s hand: who he raises up, what he allows, where he judges, and how he keeps covenant despite human failure. Read the chapter looking for the central figure, the choice being made, God\'s response (often through prophets or events), and the lesson the writer wants the next generation to take to heart.',
            highlights: ['God working through real people and events', 'Leadership that follows or fails God', 'Repentance, restoration, and consequence'],
        },
        af: {
            summary: 'Dit is OT historiese verhaal — die opgetekende verhaal van hoe Israel en haar leiers werklik met God gewandel of weggedraai het, en wat as gevolg gebeur het. Die skrywer wys God se hand: wie Hy oprig, wat Hy toelaat, waar Hy oordeel, en hoe Hy verbond hou. Soek die sentrale figuur, die keuse, God se reaksie, en die les vir die volgende geslag.',
            highlights: ['God werk deur werklike mense', 'Leierskap wat volg of misluk', 'Berou, herstel en gevolg'],
        },
    },
    wisdom: {
        en: {
            summary: 'This is wisdom literature — poetry, prayer, or reflection that puts the fear of the Lord at the centre of everyday living. Wisdom is not detached cleverness; it is knowing God truly and letting that knowledge shape how you speak, work, suffer, worship, and trust. Read the chapter slowly: notice the contrasts (wise vs. foolish, righteous vs. wicked, trust vs. anxiety), the direct address to God or to the reader, and what response — prayer, change, or worship — the text invites from you.',
            highlights: ['Fear of the Lord as foundation', 'Contrasts (wise vs. foolish)', 'Honest prayer and practical application'],
        },
        af: {
            summary: 'Dit is wysheidsliteratuur — poësie, gebed of oorpeinsing wat die vrees vir die Here in die middel van alledaagse lewe stel. Wysheid is om God werklik te ken en daardie kennis jou spraak, werk, lyding, aanbidding en vertroue te laat vorm. Let op die kontraste, die direkte aanspraak, en watter reaksie die teks van jou vra.',
            highlights: ['Vrees vir die Here as fondament', 'Kontraste (wys vs. dwaas)', 'Eerlike gebed en praktiese toepassing'],
        },
    },
    prophets: {
        en: {
            summary: 'This is prophecy — God himself speaking through chosen men to a people drifting from him. The prophet usually does three things: confront sin (indictment), warn of judgment if the people do not turn (consequence), and hold out promise of mercy and a future restoration tied to the coming Messiah. Read the chapter expecting God\'s direct speech, distinguishing what he indicts from what he promises, and watching for the longer arc — beyond the immediate audience, prophecy points to Christ and to the renewed covenant.',
            highlights: ['God confronting sin and calling for repentance', 'Judgment paired with mercy', 'Hope pointing to Messiah and renewal'],
        },
        af: {
            summary: 'Dit is profesie — God self wat deur gekose manne praat met \'n volk wat van Hom afwyk. Die profeet doen gewoonlik drie dinge: konfronteer sonde, waarsku van oordeel, en bied belofte van genade en \'n toekomstige herstel verbind met die komende Messias. Verwag God se direkte spraak en die langer boog — verby die direkte gehoor wys profesie na Christus.',
            highlights: ['God konfronteer sonde', 'Oordeel gepaar met genade', 'Hoop wat na die Messias wys'],
        },
    },
    gospels: {
        en: {
            summary: 'This is a Gospel chapter — eyewitness-rooted record of what Jesus said, did, and revealed about himself. The Gospels were not written as neutral biographies but to bring readers to faith (John 20:31). Notice what Jesus claims about his own identity, what he does that only God can do (forgive sins, heal, command nature, raise the dead, accept worship), how different people respond — faith, opposition, fear, or amazement — and what the writer wants you to conclude. Every chapter advances the case that Jesus is the Christ, the Son of God, and that life is found in his name.',
            highlights: ['Who Jesus is — words and works', 'Kingdom teaching and ethics', 'Faith vs. opposition responses'],
        },
        af: {
            summary: 'Dit is \'n Evangelie-hoofstuk — ooggetuie-gewortelde rekord van wat Jesus gesê, gedoen en oor Homself geopenbaar het. Die Evangelies is geskryf om lesers tot geloof te bring (Joh 20:31). Let op wat Jesus oor Sy identiteit aanspraak maak, wat Hy doen wat net God kan doen, hoe mense reageer, en wat die skrywer jou wil laat aflei.',
            highlights: ['Wie Jesus is — woorde en werke', 'Koninkrykslering en etiek', 'Geloof teenoor teenstand'],
        },
    },
    acts: {
        en: {
            summary: 'This chapter is part of Acts — Luke\'s record of how the risen Christ continues his work through the Spirit-empowered church. Acts is structured around Jesus\' promise in 1:8: witness in Jerusalem, Judea, Samaria, and to the ends of the earth. Read the chapter looking for the Spirit\'s role, the gospel being preached (almost always anchored in Christ\'s death and resurrection), the church\'s growth or struggle, and how God uses both miracle and opposition to advance his mission. What Acts shows is what the church is still meant to be.',
            highlights: ['The Spirit empowering witnesses', 'Gospel preaching crossing barriers', 'Church growth through both signs and suffering'],
        },
        af: {
            summary: 'Dit is deel van Handelinge — Lukas se rekord van hoe die opgestane Christus voortwerk deur die Gees-bemagtigde kerk. Soek die Gees se rol, die evangelie wat gepreek word (altyd gegrond in Christus se dood en opstanding), die kerk se groei of stryd, en hoe God beide wonderwerk en teenstand gebruik.',
            highlights: ['Die Gees bemagtig getuies', 'Evangelie steek grense oor', 'Kerk groei deur tekens én lyding'],
        },
    },
    paul: {
        en: {
            summary: 'This is a chapter from a Pauline letter — pastoral, doctrinal, written to real Christians in a specific situation. Paul\'s pattern is consistent: he lays out what God has done in Christ (justification, union with Christ, the Spirit, the new humanity) and then draws a "therefore" — how the church should live in light of it. Identify whether this chapter is teaching doctrine, applying it to church life, or both, and look for the "in Christ" reasoning underneath every command. Theology and ethics are never separated in Paul.',
            highlights: ['Gospel truth (what God has done)', 'The "therefore" — how to live', 'In-Christ reasoning behind commands'],
        },
        af: {
            summary: 'Dit is \'n hoofstuk uit \'n Pauliniese brief — pastoraal, leerstellig, geskryf aan werklike Christene. Paulus se patroon: hy stel wat God in Christus gedoen het, en trek dan \'n "daarom" — hoe die kerk moet leef. Identifiseer of die hoofstuk leer, toepas, of beide, en soek die "in Christus" redenasie agter elke gebod.',
            highlights: ['Evangelie-waarheid (wat God gedoen het)', 'Die "daarom" — hoe om te leef', '"In Christus" redenasie'],
        },
    },
    general: {
        en: {
            summary: 'This chapter comes from the general epistles — letters written to scattered, pressured, often persecuted Christians, calling them to endure, stay pure, love one another, and keep their hope fixed on the return of Christ. Watch for three pastoral concerns: endurance ("don\'t drift, don\'t give up"), purity ("don\'t compromise — with the world or with false teachers"), and hope ("Christ is coming, your faith is real"). The writer is shepherding a fragile church through real cost, and the call is the same for the church today.',
            highlights: ['Endurance under pressure', 'Holiness and resisting compromise', 'Hope fixed on Christ\'s return'],
        },
        af: {
            summary: 'Hierdie hoofstuk kom uit die algemene briewe — geskryf aan verstrooide, vervolg gelowiges, om hulle te roep tot volharding, reinheid, liefde en hoop op Christus se wederkoms. Soek drie pastorale sorge: volharding, reinheid en hoop. Die skrywer is besig om \'n broos kerk deur werklike koste te lei.',
            highlights: ['Volharding onder druk', 'Heiligheid en weerstand teen kompromis', 'Hoop op Christus se wederkoms'],
        },
    },
    revelation: {
        en: {
            summary: 'This chapter belongs to Revelation — apocalyptic vision given to John, picturing Christ\'s reign, the church\'s suffering, judgment on evil, and the renewal of all creation. Read it not first as a puzzle to solve but as a vision to live by: who is on the throne, what the Lamb (Christ) is doing, what is being said to or about the saints, and what the symbolic imagery (beasts, bowls, trumpets, the New Jerusalem) reveals about God\'s justice and mercy. The book\'s message in every chapter is the same — Christ wins, evil falls, and God will dwell with his people forever.',
            highlights: ['The Lamb who reigns', 'Christ\'s justice and mercy meeting', 'God dwelling with his people forever'],
        },
        af: {
            summary: 'Hierdie hoofstuk behoort aan Openbaring — apokaliptiese visie aan Johannes, wat Christus se regering, die kerk se lyding, die oordeel oor die bose, en die vernuwing van die skepping skilder. Lees dit nie eers as raaisel nie maar as visie: wie is op die troon, wat doen die Lam, wat word oor die heiliges gesê? Christus wen.',
            highlights: ['Die Lam wat regeer', 'Christus se geregtigheid en genade ontmoet', 'God woon vir altyd by sy volk'],
        },
    },
};

function getBookCategory(bookId) {
    if (bookId <= 5) return 'pentateuch';
    if (bookId <= 17) return 'history';
    if (bookId <= 22) return 'wisdom';
    if (bookId <= 39) return 'prophets';
    if (bookId <= 43) return 'gospels';
    if (bookId === 44) return 'acts';
    if (bookId <= 57) return 'paul';
    if (bookId <= 65) return 'general';
    return 'revelation';
}

function getBookMeta(bookId) {
    return BOOKS[bookId] || { name: `Book ${bookId}`, name_af: `Boek ${bookId}` };
}

export function getChapterSummaryContent(bookId, chapter) {
    const key = `${bookId}:${chapter}`;
    if (CURATED[key]) return CURATED[key];

    const book = getBookMeta(bookId);
    const category = getBookCategory(bookId);
    const fallback = CATEGORY_FALLBACK[category];

    if (bookId === 19) {
        return {
            en: {
                summary: `Psalm ${chapter} is a poem in the Psalter. Read the opening verses for what the psalmist declares, the middle for prayer or description, and the closing lines for how the psalm resolves.`,
                highlights: [
                    'Opening claim or address (early verses)',
                    'Central prayer, threat, or praise (middle section)',
                    'Closing trust, vow, or call to worship (final verses)',
                ],
            },
            af: {
                summary: `Psalm ${chapter} is 'n gedig in die Psalmboek. Lees die openingsverse vir wat die psalmis verklaar, die middel vir gebed of beskrywing, en die slot vir hoe die psalm eindig.`,
                highlights: [
                    'Openingsverklaring of aanspraak (vroeë verse)',
                    'Sentrale gebed, bedreiging of lof (middelste gedeelte)',
                    'Slotsvertroue, gelofte of oproep tot aanbidding (slotverse)',
                ],
            },
        };
    }

    return {
        en: {
            summary: `${book.name} ${chapter}. ${fallback.en.summary}`,
            highlights: [...fallback.en.highlights],
        },
        af: {
            summary: `${book.name_af} ${chapter}. ${fallback.af.summary}`,
            highlights: [...fallback.af.highlights],
        },
    };
}

export function buildCommentarySection(bookId, chapter) {
    const book = getBookMeta(bookId);
    const category = getBookCategory(bookId);
    const content = getChapterSummaryContent(bookId, chapter);

    const en = normalizeStudyContent(
        { ...content.en, summary: enrichSummary(content.en.summary, book.name, chapter, 'en') },
        book.name,
        chapter,
        'en'
    );
    const af = normalizeStudyContent(
        { ...content.af, summary: enrichSummary(content.af.summary, book.name_af, chapter, 'af') },
        book.name_af,
        chapter,
        'af'
    );

    const crossRefsRaw = getCrossReferences(bookId, chapter, category);
    const teaching = getChapterTeaching(bookId, chapter, category);

    return {
        book_id: bookId,
        chapter,
        heading_en: `${book.name} ${chapter}`,
        heading_af: `${book.name_af} ${chapter}`,
        summary_en: en.summary,
        summary_af: af.summary,
        study_points_en: en.points,
        study_points_af: af.points,
        teaching_en: teaching.teaching_en,
        teaching_why_en: teaching.teaching_why_en,
        teaching_af: teaching.teaching_af,
        teaching_why_af: teaching.teaching_why_af,
        cross_references_en: localizeCrossReferences(crossRefsRaw, 'en'),
        cross_references_af: localizeCrossReferences(crossRefsRaw, 'af'),
        highlights_en: en.points.map((p) => p.title),
        highlights_af: af.points.map((p) => p.title),
    };
}
