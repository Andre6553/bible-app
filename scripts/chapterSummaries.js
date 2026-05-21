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
    19: { name: 'Psalms', name_af: 'Psalms' },
    20: { name: 'Proverbs', name_af: 'Spreuke' },
    40: { name: 'Matthew', name_af: 'Matteus' },
    41: { name: 'Mark', name_af: 'Markus' },
    42: { name: 'Luke', name_af: 'Lukas' },
    43: { name: 'John', name_af: 'Johannes' },
    44: { name: 'Acts', name_af: 'Handeling' },
    45: { name: 'Romans', name_af: 'Romeine' },
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
        en: { summary: 'This chapter advances the story of God\'s covenant people — watch for promises, obedience, and how God keeps His word despite human failure.', highlights: ['Covenant promises', 'Obedience and consequences', 'God\'s faithfulness'] },
        af: { summary: 'Hierdie hoofstuk beweeg die verhaal van God se verbondsvolk vorentoe — let op beloftes, gehoorsaamheid en hoe God Sy woord hou ondanks menslike mislukking.', highlights: ['Verbondbeloftes', 'Gehoorsaamheid en gevolge', 'God se getrouheid'] },
    },
    history: {
        en: { summary: 'Historical narrative showing God\'s guidance through victory, failure, and restoration. Notice leadership, prayer, and the consequences of turning from God.', highlights: ['God\'s sovereignty in history', 'Faithful vs. unfaithful leaders', 'Repentance and restoration'] },
        af: { summary: 'Geskiedenisverhaal wat God se leiding wys deur oorwinning, mislukking en herstel. Let op leierskap, gebed en die gevolge van wegdraai van God.', highlights: ['God se soewereiniteit in geskiedenis', 'Getroue vs. ontroue leiers', 'Berou en herstel'] },
    },
    wisdom: {
        en: { summary: 'Wisdom literature for worship, prayer, and practical living. Apply its truths to your relationships, work, and inner life.', highlights: ['Fear of the Lord', 'Honest self-reflection', 'Practical daily application'] },
        af: { summary: 'Wysheidsliteratuur vir aanbidding, gebed en praktiese lewe. Pas die waarhede toe op jou verhoudings, werk en innerlike lewe.', highlights: ['Vrees vir die Here', 'Eerlike selfondersoek', 'Praktiese daaglikse toepassing'] },
    },
    prophets: {
        en: { summary: 'Prophetic word calling God\'s people to covenant faithfulness. Listen for judgment, hope, and promises pointing to Messiah and restoration.', highlights: ['Sin and repentance', 'God\'s holy standards', 'Hope for the future'] },
        af: { summary: 'Profetiese woord wat God se volk roep tot verbondstrousheid. Luister vir vonnis, hoop en beloftes wat wys na Messias en herstel.', highlights: ['Sonde en berou', 'God se heilige standaarde', 'Hoop vir die toekoms'] },
    },
    gospels: {
        en: { summary: 'The Gospels reveal Jesus — His teaching, authority, compassion, and mission. Ask: Who is Jesus here, and what is He calling me to believe and do?', highlights: ['Jesus\' identity and authority', 'Kingdom teaching', 'Calls to follow'] },
        af: { summary: 'Die Evangelies openbaar Jesus — Sy lering, gesag, barmhartigheid en sending. Vra: Wie is Jesus hier, en wat roep Hy my om te glo en te doen?', highlights: ['Jesus se identiteit en gesag', 'Koninkryk-lering', 'Oproepe om te volg'] },
    },
    acts: {
        en: { summary: 'The Spirit-empowered spread of the Gospel. Notice courage, community life, prayer, and how the church responds to persecution.', highlights: ['Holy Spirit\'s power', 'Bold witness', 'Growing community'] },
        af: { summary: 'Die Gees-bemagtigde verspreiding van die Evangelie. Let op moed, gemeenskaplewe, gebed en hoe die kerk op vervolging reageer.', highlights: ['Heilige Gees se krag', 'Dapper getuienis', 'Groeiende gemeenskap'] },
    },
    paul: {
        en: { summary: 'Paul teaches doctrine and Christian living. Connect theological truth to practical obedience in church, family, and daily relationships.', highlights: ['Gospel truth', 'Life in the Spirit', 'Practical ethics'] },
        af: { summary: 'Paulus leer leerstelling en Christelike lewe. Verbind teologiese waarheid met praktiese gehoorsaamheid in kerk, gesin en daaglikse verhoudings.', highlights: ['Evangelie-waarheid', 'Lewe in die Gees', 'Praktiese etiek'] },
    },
    general: {
        en: { summary: 'Pastoral encouragement for faith under pressure. Look for calls to endurance, love, holiness, and confident hope in Christ.', highlights: ['Endurance in trials', 'Love and unity', 'Hope in Christ\'s return'] },
        af: { summary: 'Pastorale bemoediging vir geloof onder druk. Soek oproepe tot volharding, liefde, heiligheid en versekerde hoop in Christus.', highlights: ['Volharding in beproewing', 'Liefde en eenheid', 'Hoop in Christus se wederkoms'] },
    },
    revelation: {
        en: { summary: 'Apocalyptic vision of Christ\'s victory and final renewal. Balance symbolic imagery with the certainty that God wins and His people inherit eternal life.', highlights: ['Christ the victorious Lamb', 'Judgment and mercy', 'New creation hope'] },
        af: { summary: 'Apokaliptiese visie van Christus se oorwinning en finale vernuwing. Balanseer simboliese beelde met die sekerheid dat God wen en Sy volk erf ewige lewe.', highlights: ['Christus die oorwinnaar-Lam', 'Vonnis en barmhartigheid', 'Nuwe-skepping hoop'] },
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
