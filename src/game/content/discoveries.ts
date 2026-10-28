import { LANDMARKS } from '../../data/landmarks';
import type { BuildingPhase, SourceRef } from '../../data/types';
import type { Discovery, SiteMatch, Spot } from '../types';
import { HERZL_PHOTO, SOSKIN_PHOTO } from './photos';
import { POIS } from './pois';

const W = (title: string): string => `https://en.wikipedia.org/wiki/${title}`;
const WIKI = (label: string, title: string): SourceRef => ({ label: `${label} – Wikipedia`, url: W(title) });
const UNESCO: SourceRef = { label: 'UNESCO – White City of Tel-Aviv', url: 'https://whc.unesco.org/en/list/1096/' };
const WHITE_CITY = WIKI('White City (Tel Aviv)', 'White_City_(Tel_Aviv)');
const AHUZAT_BAYIT = WIKI('Ahuzat Bayit', 'Ahuzat_Bayit');
const ROTHSCHILD = WIKI('Rothschild Boulevard', 'Rothschild_Boulevard');

/** A landmark's search circle (for a nudge). */
function near(id: string, r: number): Spot {
  const s = LANDMARKS.find((l) => l.id === id);
  if (!s) throw new Error(`Unknown landmark ${id}`);
  return { x: s.x, z: s.z, r };
}

const weathered = (p: BuildingPhase) => (p.weathering ?? 0) > 0.4;
const WHITE: SiteMatch = { style: 'bauhaus', test: (p) => !weathered(p) };
const GREY: SiteMatch = { style: 'bauhaus', test: weathered };
/** Restored after the UNESCO listing (fabric.ts: restoration phases start in 2004 or later). */
const RESTORED: SiteMatch = { style: 'bauhaus', test: (p) => p.from >= 2004 && !weathered(p) };
const mosaic = POIS.find((p) => p.id === 'gutman-mosaic')!;

/**
 * Everything the notebook can record. Nothing is marked in the world: the riddle says what to
 * look for, the nudge narrows it down, and the player has to notice it.
 */
export const DISCOVERIES: Discovery[] = [
  // ---------------------------------------------------------------- the White City
  {
    id: 'ribbon-balconies',
    collection: 'white-city',
    title: { en: 'Ribbon balconies' },
    riddle: { en: 'Long horizontal bands that shade a white wall.' },
    nudge: { en: 'Any building of the 1930s will do, in a year when it is well kept. Get close and look at its front.' },
    trigger: { kind: 'look', match: WHITE, maxDist: 22, years: [1931, 2025], wall: 'front' },
    gist: { en: 'Long balconies run across the front: each one shades the floor below from the sun.' },
    text: {
      en: 'Tel Aviv’s International Style buildings wrap their fronts in long horizontal balconies. Each balcony shades the windows below, and their solid parapets give the façade its stripes. In Europe the style favoured big windows; here architects made windows smaller and balconies deeper, to keep homes cool on a hot, bright coast.',
    },
    sources: [WHITE_CITY, UNESCO],
    confidence: 'documented',
  },
  {
    id: 'thermometer-windows',
    collection: 'white-city',
    title: { en: 'Thermometer windows' },
    riddle: { en: 'A tall, narrow strip of glass running up a wall.' },
    nudge: { en: 'Walk round to the side of a 1930s building, where its stairs are.' },
    trigger: { kind: 'look', match: { style: 'bauhaus' }, maxDist: 18, years: [1931, 2025], wall: 'side' },
    gist: { en: 'A narrow vertical window lights the staircase from bottom to top. Locals call it a thermometer window.' },
    text: {
      en: 'Many White City stairwells are lit by one tall slot of glass running the height of the building. From the street it looks like the column of a thermometer. It brings daylight to every landing while letting in little heat, and it shows from outside where the stairs are: the building explains itself.',
    },
    sources: [WHITE_CITY],
    confidence: 'documented',
  },
  {
    id: 'pilotis',
    collection: 'white-city',
    title: { en: 'On columns' },
    riddle: { en: 'A building on the boulevard that stands on columns.' },
    nudge: { en: 'Rothschild Boulevard, towards its northern end, after 1933.' },
    area: near('engel-house', 70),
    trigger: { kind: 'look', match: { site: 'engel-house' }, maxDist: 30, years: [1933, 2025] },
    gist: { en: 'Engel House (1933) was one of the first buildings in Tel Aviv lifted on pilotis: columns that free the ground floor.' },
    text: {
      en: 'Ze’ev Rechter’s Engel House at 84 Rothschild Boulevard raised its flats on columns, an idea from Le Corbusier. The open ground floor lets the sea breeze pass under the building and gives the street shade and garden. Pilotis soon became a standard feature of Tel Aviv apartment blocks; look for them on other streets.',
    },
    sources: [WIKI('Ze’ev Rechter', 'Ze%27ev_Rechter'), WHITE_CITY],
    confidence: 'documented',
  },
  {
    id: 'closed-balconies',
    collection: 'white-city',
    title: { en: 'Closed-in balconies' },
    riddle: { en: 'Where the balconies became rooms.' },
    nudge: { en: 'Look at a 1930s building in 1985.' },
    trigger: { kind: 'look', match: GREY, maxDist: 22, years: [1960, 2025] },
    gist: { en: 'From the 1960s many residents closed their balconies with shutters and blocks to gain a room.' },
    text: {
      en: 'Families grew and flats stayed small, so owners walled in their open balconies with shutters, glass or concrete blocks. Air conditioners, water heaters and grime followed, and the boulevards went through decades of decay. By the 1980s many White City buildings were grey and their stripes were broken.',
    },
    sources: [ROTHSCHILD, WHITE_CITY],
    confidence: 'approximate',
  },
  {
    id: 'white-again',
    collection: 'white-city',
    title: { en: 'White again' },
    riddle: { en: 'A grey building that turned white.' },
    nudge: { en: 'Stand by a weathered 1930s building in 1985, then slip or peek into 2025.' },
    trigger: { kind: 'compare', from: [1962, 2003], to: [2004, 2025], where: { near: GREY, then: RESTORED, r: 26 } },
    gist: { en: 'After UNESCO listed the White City in 2003, many buildings were restored: plaster repaired, balconies reopened, white again.' },
    text: {
      en: 'The UNESCO listing and the city’s conservation plan brought rules and money for restoration. Many buildings that are grey in 1985 are white again today, with their balconies reopened. Not all of them: look along the street and you will still find grey ones.',
    },
    sources: [UNESCO, WHITE_CITY, ROTHSCHILD],
    confidence: 'approximate',
  },
  {
    id: 'one-floor-more',
    collection: 'white-city',
    title: { en: 'One floor more' },
    riddle: { en: 'An old building with something new on its roof.' },
    nudge: { en: 'Today, look at the top of a restored 1930s building. Some are a floor taller than they were.' },
    trigger: { kind: 'look', match: { style: 'bauhaus', test: (p) => !!p.note?.en.includes('TAMA') }, maxDist: 30, years: [2004, 2025] },
    gist: { en: 'Some restored buildings carry an extra floor, allowed in return for strengthening and restoring the old one.' },
    text: {
      en: 'Restoration is expensive. Israel’s national plan TAMA 38 (2005) lets owners add floors if they strengthen a building against earthquakes, and conservation rules allow some additions in the White City, usually set back from the façade. The new flats pay for the work, and change the building’s proportions.',
    },
    sources: [WIKI('TAMA 38', 'TAMA_38'), WHITE_CITY],
    confidence: 'approximate',
  },

  // ---------------------------------------------------------------- before the White City
  {
    id: 'garden-houses',
    collection: 'before-white',
    title: { en: 'Red roofs and gardens' },
    riddle: { en: 'A small house with a red tiled roof and a garden wall.' },
    nudge: { en: 'Herzl or Ahad Ha’am Street, in 1909 or 1922.' },
    trigger: { kind: 'look', match: { style: 'ottoman-house' }, maxDist: 22, years: [1909, 1930] },
    gist: { en: 'The first houses of Ahuzat Bayit had one or two floors, roofs of red Marseille tiles and a garden each.' },
    text: {
      en: 'Each family built its own house on its plot, with a garden in front behind a low wall: the founders wanted a quiet, green suburb, away from crowded Jaffa. Almost all of these houses were replaced in the 1920s and 30s by bigger buildings.',
    },
    sources: [AHUZAT_BAYIT],
    confidence: 'documented',
  },
  {
    id: 'eclectic',
    collection: 'before-white',
    title: { en: 'East meets West' },
    riddle: { en: 'Arches, ornaments and coloured tiles.' },
    nudge: { en: 'Allenby Street, in 1922 or 1936.' },
    trigger: { kind: 'look', match: { style: 'eclectic' }, maxDist: 22, years: [1919, 2025] },
    gist: { en: 'The eclectic style of the 1920s mixed European classicism with “oriental” arches, small domes and ceramic tiles.' },
    text: {
      en: 'In the 1920s the town grew fast and its builders looked for a local style. They mixed classical details with arches, domes and decorative tiles, many made by artists of the Bezalel school. Ze’ev Raban’s ceramic murals on the Lederberg House (1925), at Rothschild and Allenby, are a well-known example.',
    },
    sources: [ROTHSCHILD, WIKI('Architecture of Israel', 'Architecture_of_Israel')],
    confidence: 'documented',
  },
  {
    id: 'pagoda-house',
    collection: 'before-white',
    title: { en: 'The Pagoda House' },
    riddle: { en: 'A house with a roof from the Far East.' },
    nudge: { en: 'King Albert Square, after 1925.' },
    area: near('pagoda-house', 70),
    trigger: { kind: 'look', match: { site: 'pagoda-house' }, maxDist: 40, years: [1925, 2025] },
    gist: { en: 'Alexander Levy’s Pagoda House (1925) is eclectic at its most playful: a villa topped with a pagoda-like roof.' },
    text: {
      en: 'Designed by Alexander Levy and finished in 1925, the villa on King Albert Square mixes a pagoda-like roof with classical columns and arches. It shows how freely 1920s Tel Aviv borrowed from everywhere. Its exact position in this model is approximate.',
    },
    sources: [WIKI('Pagoda House', 'Pagoda_House')],
    confidence: 'approximate',
  },

  // ---------------------------------------------------------------- building a city
  {
    id: 'lottery',
    collection: 'building-city',
    title: { en: 'The lottery on the dune' },
    riddle: { en: 'An old photograph: a crowd on bare sand. Where was it taken?' },
    nudge: { en: 'In 1909, near where Rothschild Boulevard now begins. The photographer stood a few steps from the crowd.' },
    area: { x: SOSKIN_PHOTO.pose.x, z: SOSKIN_PHOTO.pose.z, r: 70 },
    trigger: {
      kind: 'photo',
      photo: SOSKIN_PHOTO,
      years: [1909, 1909],
      find: { kind: 'poi', poi: 'lottery-crowd', maxDist: 45 },
      clue: { en: 'One morning in 1909 a crowd gathered on the bare dune. Find them, and their photograph will turn up.' },
    },
    gist: { en: 'On 11 April 1909 the founding families drew lots with seashells to share out the plots fairly.' },
    text: {
      en: 'The 66 families of Ahuzat Bayit gathered on the dune to divide the land into plots along Herzl Street. Family names were written on white seashells and plot numbers on dark ones, and a child drew one shell from each box in turn, so no one could choose the best plot. Avraham Soskin photographed the gathering; the spot later became Rothschild Boulevard. Some details, such as the child’s name, come from memoirs.',
    },
    sources: [AHUZAT_BAYIT],
    confidence: 'approximate',
  },
  {
    id: 'herzl-axis',
    collection: 'building-city',
    title: { en: 'A street aimed at a school' },
    riddle: { en: 'An old photograph: a long street and a grand building at its end. Where was it taken?' },
    nudge: { en: 'The school stood at the head of Herzl Street until 1961. The photographer was up on a roof on Herzl Street, north of the boulevard: rise to see it as he did.' },
    area: { x: HERZL_PHOTO.pose.x, z: HERZL_PHOTO.pose.z, r: 70 },
    trigger: {
      kind: 'photo',
      photo: HERZL_PHOTO,
      years: [1910, 1925],
      find: { kind: 'look', match: { site: 'herzliya-gymnasium' }, maxDist: 90, years: [1910, 1961] },
      clue: { en: 'A school with two towers once stood at the end of a street. Notice it, and an old photograph of it will turn up.' },
    },
    gist: { en: 'Herzl Street was laid out to lead straight to the Herzliya Gymnasium, the first Hebrew high school (1910).' },
    text: {
      en: 'The planners gave the new town a focus: its first street ran straight to the school, whose temple-like façade Joseph Barsky modelled on reconstructions of Solomon’s Temple. The photograph was taken in 1913 from a rooftop, looking down on the street.',
    },
    sources: [AHUZAT_BAYIT, WIKI('Herzliya Hebrew Gymnasium', 'Herzliya_Hebrew_Gymnasium')],
    confidence: 'documented',
  },
  {
    id: 'water-tower',
    collection: 'building-city',
    title: { en: 'Water for the suburb' },
    riddle: { en: 'The first thing in town taller than a house.' },
    nudge: { en: 'On the boulevard, in 1909 or 1922.' },
    area: near('water-tower', 70),
    trigger: { kind: 'look', match: { site: 'water-tower' }, maxDist: 40, years: [1909, 1929] },
    gist: { en: 'Running water from a well and a tower was one of the promises of the new garden suburb.' },
    text: {
      en: 'Jaffa’s crowded houses drew water from wells and carriers. Ahuzat Bayit promised every house running water from a central well and tower on the boulevard, the town’s first public infrastructure. The tower’s exact position and demolition date here are approximate.',
    },
    sources: [AHUZAT_BAYIT],
    confidence: 'approximate',
  },
  {
    id: 'tree-boulevard',
    collection: 'building-city',
    title: { en: 'A boulevard of trees' },
    riddle: { en: 'This shady boulevard was once bare sand.' },
    nudge: { en: 'Stand on Rothschild Boulevard, then compare 1909 with a later year.' },
    trigger: { kind: 'compare', from: [1909, 1910], to: [1930, 2025], where: { street: 'rothschild', margin: 1 } },
    gist: { en: 'The founders gave their suburb a wide boulevard with a central promenade; its trees grew into today’s green tunnel.' },
    text: {
      en: 'Rothschild Boulevard was one of the first streets, with a walk down the middle. The trees planted there grew into the shady promenade of today, and the boulevard became the city’s living room: kiosks, benches and cafés. A 1995 plan restored its historic kiosks and added walking and cycling paths.',
    },
    sources: [ROTHSCHILD],
    confidence: 'approximate',
  },
  {
    id: 'beyond-first-streets',
    collection: 'building-city',
    title: { en: 'Beyond the first streets' },
    riddle: { en: 'Where the town went next.' },
    nudge: { en: 'Stand on Allenby Street in 1909, then slip or peek into 1922.' },
    trigger: { kind: 'compare', from: [1909, 1913], to: [1920, 2025], where: { street: 'allenby', margin: 3 } },
    gist: { en: 'After the First World War the town spread over the dunes, and Allenby Street became its main shopping street.' },
    text: {
      en: 'Ahuzat Bayit was a handful of streets. After the war the town grew fast over the sand, and a street running down to the sea was named after General Edmund Allenby, whose army had taken the area in 1917. In the 1920s and 30s it was Tel Aviv’s busiest commercial street.',
    },
    sources: [WIKI('Allenby Street', 'Allenby_Street')],
    confidence: 'approximate',
  },
  {
    id: 'school-to-tower',
    collection: 'building-city',
    title: { en: 'A school for a tower' },
    riddle: { en: 'Where a school stood, something much taller.' },
    nudge: { en: 'At the head of Herzl Street, compare 1960 with a later year.' },
    area: near('herzliya-gymnasium', 80),
    trigger: { kind: 'compare', from: [1910, 1961], to: [1965, 2025], where: { spot: near('herzliya-gymnasium', 75) } },
    gist: { en: 'The Herzliya Gymnasium was demolished in 1962 for the Shalom Meir Tower, the tallest building in the Middle East when it opened in 1965.' },
    text: {
      en: 'In the 1960s the city wanted to look modern. The school moved to a new campus, its old building was razed, and an office tower with one of Israel’s first department stores rose in its place. The loss of the Gymnasium is often cited as a spark for Israel’s preservation movement.',
    },
    sources: [WIKI('Herzliya Hebrew Gymnasium', 'Herzliya_Hebrew_Gymnasium'), WIKI('Shalom Meir Tower', 'Shalom_Meir_Tower')],
    confidence: 'documented',
  },
  {
    id: 'tents',
    collection: 'building-city',
    title: { en: 'Tents on the boulevard' },
    riddle: { en: 'A summer when people camped on the boulevard.' },
    nudge: { en: 'Rothschild Boulevard, in 2011.' },
    trigger: { kind: 'look', match: { style: 'tent' }, maxDist: 15, years: [2011, 2011] },
    gist: { en: 'In the summer of 2011 hundreds of tents lined Rothschild Boulevard in a protest over the cost of housing.' },
    text: {
      en: 'It began in July 2011, when Daphni Leef pitched a tent on the boulevard because she could no longer afford her rent. Within weeks tents filled the promenade, and hundreds of thousands marched across the country for affordable housing and a lower cost of living.',
    },
    sources: [WIKI('2011 Israeli housing protests', '2011_Israeli_housing_protests')],
    confidence: 'documented',
  },

  // ---------------------------------------------------------------- city life
  {
    id: 'first-kiosk',
    collection: 'city-life',
    title: { en: 'The first kiosk' },
    riddle: { en: 'A tiny green shop on the boulevard.' },
    nudge: { en: 'Where Rothschild Boulevard meets Herzl Street.' },
    area: near('first-kiosk', 50),
    trigger: { kind: 'look', match: { site: 'first-kiosk' }, maxDist: 25, years: [1910, 2025] },
    gist: { en: 'Boulevard kiosks, selling soda water, ices and newspapers, became a Tel Aviv institution; the first stood here by 1910.' },
    text: {
      en: 'A kiosk stood on the boulevard by 1910, next to the water tower. Kiosks became meeting points on every boulevard, and many were restored after the 1995 plan to renew Rothschild Boulevard.',
    },
    sources: [AHUZAT_BAYIT, ROTHSCHILD],
    confidence: 'approximate',
  },
  {
    id: 'museum',
    collection: 'city-life',
    title: { en: 'A museum in the mayor’s house' },
    riddle: { en: 'Paintings in a house on the boulevard.' },
    nudge: { en: '16 Rothschild Boulevard, in 1936 or 1960.' },
    area: near('dizengoff-house', 50),
    trigger: { kind: 'look', match: { site: 'dizengoff-house' }, maxDist: 40, years: [1932, 1971] },
    gist: { en: 'Meir Dizengoff, the first mayor, gave his house to become the Tel Aviv Museum of Art, which opened in 1932.' },
    text: {
      en: 'The house was built in 1910 on lottery plot no. 43. After his wife Zina died in 1930, Dizengoff donated it for a museum in her memory, and it was remodelled in the International Style. The museum stayed until 1971, when it moved to a new building; the house is now Independence Hall.',
    },
    sources: [WIKI('Tel Aviv Museum of Art', 'Tel_Aviv_Museum_of_Art'), WIKI('Independence Hall', 'Independence_Hall_(Israel)')],
    confidence: 'documented',
  },
  {
    id: 'synagogue-arches',
    collection: 'city-life',
    title: { en: 'A new face for the synagogue' },
    riddle: { en: 'A dome that disappeared behind arches.' },
    nudge: { en: 'On Allenby Street, compare 1960 with 1985.' },
    area: near('great-synagogue', 70),
    trigger: { kind: 'compare', from: [1926, 1969], to: [1970, 2025], where: { spot: near('great-synagogue', 60) } },
    gist: { en: 'The Great Synagogue (1926) was wrapped in a façade of tall concrete arches in a 1970 renovation.' },
    text: {
      en: 'Yehuda Magidovitch’s synagogue on Allenby Street, with its large dome, was a landmark of the 1920s. In 1970 it was renovated and surrounded by modernist arches that hide much of the original building: each era dressed the city’s buildings in its own style.',
    },
    sources: [WIKI('Great Synagogue (Tel Aviv)', 'Great_Synagogue_(Tel_Aviv)')],
    confidence: 'approximate',
  },
  {
    id: 'founders-fountain',
    collection: 'city-life',
    title: { en: 'The founders’ fountain' },
    riddle: { en: 'Stone reliefs and a fountain in the middle of the boulevard.' },
    nudge: { en: 'Rothschild Boulevard at Nahalat Binyamin Street, after 1951.' },
    area: near('founders-monument', 50),
    trigger: { kind: 'look', match: { site: 'founders-monument' }, maxDist: 40, years: [1951, 2025] },
    gist: { en: 'The Founders’ Monument and fountain tell the story of the city’s founding in stone relief.' },
    text: {
      en: 'Put up after independence near where the first well and water tower stood, the monument shows the dunes being levelled and the town rising. It stands on the boulevard the founders laid out.',
    },
    sources: [{ label: 'Founders Monument – Israel Public Art', url: 'https://israelpublicart.com/collection/founders-monument/' }, AHUZAT_BAYIT],
    confidence: 'approximate',
  },
  {
    id: 'gutman-mosaic',
    collection: 'city-life',
    title: { en: 'A wall that tells the story' },
    riddle: { en: 'A wall of small tiles with the city’s whole history.' },
    nudge: { en: 'At the foot of the tower at the head of Herzl Street, after 1966.' },
    area: { x: mosaic.x, z: mosaic.z, r: 45 },
    trigger: { kind: 'poi', poi: 'gutman-mosaic', maxDist: 20 },
    gist: { en: 'Nachum Gutman’s mosaic (1966) tells Tel Aviv’s story, from old Jaffa to the young city, Gymnasium included.' },
    text: {
      en: 'The painter Nachum Gutman, who grew up in the first years of Tel Aviv, made a long mosaic for the new tower: Jaffa, the founding of Ahuzat Bayit and the young city, with the Gymnasium that stood on this spot among its buildings.',
    },
    sources: [WIKI('Shalom Meir Tower', 'Shalom_Meir_Tower'), WIKI('Nachum Gutman', 'Nachum_Gutman')],
    confidence: 'approximate',
  },
];
