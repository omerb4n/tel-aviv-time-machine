import { toLocal } from '../core/geo';
import { frameAt, placeOnStreet, streetById, GRID_BEARING } from './streets';
import type { BuildingSite } from './types';

const W = (title: string) => `https://en.wikipedia.org/wiki/${title}`;
/** Rotation that aligns a building's local +x with the Rothschild-parallel grid. */
const GRID_ROT = ((90 - GRID_BEARING) * Math.PI) / 180;

function onPromenade(s: number) {
  const f = frameAt(streetById('rothschild'), s);
  return { x: f.x, z: f.z, rot: Math.atan2(f.dx, f.dz) };
}

function at(lat: number, lon: number, rot = 0) {
  return { ...toLocal(lat, lon), rot };
}

/**
 * Hand-authored landmark sites. Each site can have several phases (e.g. a house that
 * becomes a museum). Add new landmarks here — see docs/CONTENT_GUIDE.md.
 */
export const LANDMARKS: BuildingSite[] = [
  {
    id: 'herzliya-gymnasium',
    name: { en: 'Herzliya Hebrew Gymnasium', he: 'הגימנסיה העברית הרצליה' },
    x: -14,
    z: -176,
    rot: 0.087,
    width: 62,
    depth: 24,
    landmark: true,
    phases: [{ from: 1910, to: 1961, style: 'gymnasium', color: '#efe3c8' }],
    info: {
      architect: 'Joseph Barsky (façade concept with Boris Schatz)',
      address: 'Head of Herzl St',
      summary: {
        en: 'The first Hebrew high school in the world moved here in 1910 and became the symbol of the new town: Herzl Street was laid out as a straight axis leading to its temple-like façade.',
      },
      facts: [
        { en: 'The cornerstone was laid on 28 July 1909, months after the seashell lottery.' },
        { en: 'Barsky drew on Charles Chipiez’s 1889 reconstruction of Solomon’s Temple.' },
        { en: 'Razed in 1962 for the Shalom Meir Tower; its loss helped spark Israel’s preservation movement.' },
      ],
      sources: [
        { label: 'Herzliya Hebrew Gymnasium – Wikipedia', url: W('Herzliya_Hebrew_Gymnasium') },
        { label: 'Joseph Barsky – Wikipedia', url: W('Joseph_Barsky') },
      ],
      confidence: 'documented',
    },
  },
  {
    id: 'shalom-meir-tower',
    name: { en: 'Shalom Meir Tower', he: 'מגדל שלום מאיר' },
    x: -14,
    z: -176,
    rot: 0.087,
    width: 70,
    depth: 40,
    landmark: true,
    phases: [{ from: 1965, style: 'shalom-tower', height: 129, color: '#dcd8cc' }],
    info: {
      architect: 'Meir Levy, Gideon Ziv, Yitzhak Perlstein (with others)',
      address: '9 Ahad Ha’am St',
      summary: {
        en: 'Built on the site of the Gymnasium, the Shalom Meir Tower was the tallest building in the Middle East when it was completed in 1965 — a statement of the young state’s modern ambition.',
      },
      facts: [
        { en: 'About 129 m tall with 34 floors (sources differ slightly).' },
        { en: 'Its podium housed one of Israel’s first department stores.' },
      ],
      sources: [{ label: 'Shalom Meir Tower – Wikipedia', url: W('Shalom_Meir_Tower') }],
      confidence: 'documented',
    },
  },
  {
    id: 'dizengoff-house',
    name: { en: 'Dizengoff House · Independence Hall', he: 'בית דיזנגוף · היכל העצמאות' },
    ...placeOnStreet('rothschild', 118, 'R', 16, 5),
    width: 18,
    depth: 16,
    landmark: true,
    phases: [
      {
        from: 1910,
        to: 1931,
        style: 'ottoman-house',
        floors: 2,
        color: '#eadcbf',
        note: { en: 'Home of Meir and Zina Dizengoff, built on lottery plot no. 43.' },
      },
      {
        from: 1932,
        style: 'museum-cube',
        floors: 2,
        width: 22,
        color: '#f1eee6',
        note: { en: 'Remodelled in the International Style as the Tel Aviv Museum of Art; Israel’s independence was declared in its hall.' },
      },
    ],
    info: {
      architect: 'Remodelled 1930s, attributed to Carl Rubin',
      address: '16 Rothschild Blvd',
      summary: {
        en: 'Built as the home of Meir Dizengoff, Tel Aviv’s first mayor, it became the city’s art museum and, on 14 May 1948, the room where David Ben-Gurion declared the State of Israel.',
      },
      facts: [
        { en: 'The Dizengoffs won plot no. 43 in the 1909 lottery.' },
        { en: 'The museum occupied the building until 1971; it reopened as Independence Hall in 1978.' },
      ],
      sources: [
        { label: 'Independence Hall – Wikipedia', url: W('Independence_Hall_(Israel)') },
        { label: 'Jewish Virtual Library – Independence Hall', url: 'https://www.jewishvirtuallibrary.org/independence-hall' },
      ],
      confidence: 'documented',
    },
  },
  {
    id: 'first-kiosk',
    name: { en: 'The first kiosk', he: 'הקיוסק הראשון' },
    ...onPromenade(16),
    width: 4,
    depth: 4,
    landmark: true,
    phases: [{ from: 1910, style: 'kiosk', color: '#3d6b5a' }],
    info: {
      address: 'Rothschild Blvd at Herzl St',
      summary: {
        en: 'A small kiosk on the boulevard, photographed beside the water tower in 1910. Boulevard kiosks — soda water, ices and newspapers — became a Tel Aviv institution.',
      },
      sources: [{ label: 'Ahuzat Bayit – Wikipedia', url: W('Ahuzat_Bayit') }],
      confidence: 'approximate',
    },
  },
  {
    id: 'water-tower',
    name: { en: 'Ahuzat Bayit water tower', he: 'מגדל המים של אחוזת בית' },
    ...onPromenade(190),
    width: 7,
    depth: 7,
    landmark: true,
    phases: [{ from: 1909, to: 1929, style: 'water-tower', color: '#d9c6a0' }],
    info: {
      address: 'Rothschild Blvd at Nahalat Binyamin St',
      summary: {
        en: 'Running water from a central well and tower was one of the promises of the new garden suburb. The tower appears in photographs of 1910 next to the first kiosk.',
      },
      facts: [{ en: 'The demolition date and exact position shown here are approximate.' }],
      sources: [{ label: 'Ahuzat Bayit – Wikipedia', url: W('Ahuzat_Bayit') }],
      confidence: 'approximate',
    },
  },
  {
    id: 'founders-monument',
    name: { en: 'Founders’ Monument & Fountain', he: 'אנדרטת המייסדים' },
    ...onPromenade(190),
    width: 12,
    depth: 12,
    landmark: true,
    phases: [{ from: 1951, style: 'founders-monument', color: '#cbbd9f' }],
    info: {
      address: 'Rothschild Blvd at Nahalat Binyamin St',
      summary: { en: 'A stone monument with reliefs telling the story of the city’s founding, near where the first well and water tower stood.' },
      confidence: 'approximate',
    },
  },
  {
    id: 'great-synagogue',
    name: { en: 'Great Synagogue', he: 'בית הכנסת הגדול' },
    ...placeOnStreet('allenby', 560, 'R', 28, 4),
    width: 28,
    depth: 28,
    landmark: true,
    phases: [
      { from: 1926, to: 1969, style: 'synagogue-dome', color: '#e6d6b5' },
      {
        from: 1970,
        style: 'synagogue-arches',
        color: '#d7d2c6',
        note: { en: 'Wrapped in a modernist façade of tall concrete arches.' },
      },
    ],
    info: {
      architect: 'Yehuda Magidovitch (original design)',
      address: '110 Allenby St',
      summary: {
        en: 'Tel Aviv’s main synagogue, its large dome a landmark of 1920s Allenby Street. A 1970 renovation surrounded it with tall arches.',
      },
      sources: [{ label: 'Great Synagogue (Tel Aviv) – Wikipedia', url: W('Great_Synagogue_(Tel_Aviv)') }],
      confidence: 'approximate',
    },
  },
  {
    id: 'pagoda-house',
    name: { en: 'Pagoda House', he: 'בית הפגודה' },
    x: 470,
    z: -430,
    rot: GRID_ROT,
    width: 16,
    depth: 16,
    landmark: true,
    phases: [{ from: 1925, style: 'pagoda-house', floors: 3, color: '#efe1c3' }],
    info: {
      architect: 'Alexander Levy',
      address: 'King Albert Square',
      summary: { en: 'An exuberant eclectic villa with a pagoda-like roof — a signature of 1920s Tel Aviv’s mix of East and West.' },
      facts: [{ en: 'Position in this scene is approximate.' }],
      sources: [{ label: 'Pagoda House – Wikipedia', url: W('Pagoda_House') }],
      confidence: 'approximate',
    },
  },
  {
    id: 'engel-house',
    name: { en: 'Engel House', he: 'בית אנגל' },
    ...placeOnStreet('rothschild', 820, 'R', 14, 5),
    width: 20,
    depth: 14,
    landmark: true,
    phases: [{ from: 1933, style: 'bauhaus', floors: 4, color: '#f2f0ea' }],
    info: {
      architect: 'Ze’ev Rechter',
      address: '84 Rothschild Blvd',
      summary: {
        en: 'Among the first buildings in Tel Aviv raised on pilotis (columns), freeing the ground floor for shade and sea breeze — a Le Corbusier idea that became standard across the White City.',
      },
      sources: [{ label: 'Ze’ev Rechter – Wikipedia', url: W('Ze%27ev_Rechter') }],
      confidence: 'approximate',
    },
  },
  {
    id: 'jaffa-clock-tower',
    name: { en: 'Jaffa Clock Tower', he: 'מגדל השעון ביפו' },
    ...at(32.055, 34.7565),
    width: 5,
    depth: 5,
    landmark: true,
    phases: [{ from: 1903, style: 'clock-tower', color: '#d8c49c' }],
    info: {
      address: 'Yefet St, Jaffa',
      summary: { en: 'One of several clock towers built across the Ottoman Empire for the jubilee of Sultan Abdul Hamid II.' },
      sources: [{ label: 'Jaffa Clock Tower – Wikipedia', url: W('Jaffa_Clock_Tower') }],
      confidence: 'approximate',
    },
  },
  {
    id: 'st-peters',
    name: { en: 'St Peter’s Church, Jaffa', he: 'כנסיית פטרוס הקדוש' },
    ...at(32.0538, 34.7518, 0.3),
    width: 18,
    depth: 40,
    landmark: true,
    phases: [{ from: 1894, style: 'church', color: '#c98c5a' }],
    info: {
      address: 'Kedumim Square, Old Jaffa',
      summary: { en: 'The Franciscan church on the Jaffa hilltop, its bell tower visible from the sea — the skyline every arriving traveller saw.' },
      sources: [{ label: 'St. Peter’s Church, Jaffa – Wikipedia', url: W('St._Peter%27s_Church,_Jaffa') }],
      confidence: 'approximate',
    },
  },
  {
    id: 'jaffa-station',
    name: { en: 'Jaffa railway station', he: 'תחנת הרכבת יפו (התחנה)' },
    ...at(32.059, 34.762, 1.2),
    width: 24,
    depth: 10,
    landmark: true,
    phases: [{ from: 1892, style: 'ottoman-house', floors: 1, color: '#dccbaa' }],
    info: {
      address: 'HaTachana, Neve Tzedek',
      summary: {
        en: 'Terminus of the Jaffa–Jerusalem railway (1892). Herzl Street originally ran south to the tracks. Closed after 1948, it reopened in 2010 as the HaTachana leisure compound.',
      },
      sources: [{ label: 'Jaffa railway station – Wikipedia', url: W('Jaffa_railway_station') }],
      confidence: 'approximate',
    },
  },
  {
    id: 'azrieli-circular',
    name: { en: 'Azrieli Center – Circular Tower', he: 'מגדלי עזריאלי – העגול' },
    ...at(32.0745, 34.792),
    width: 50,
    depth: 50,
    landmark: true,
    phases: [{ from: 1999, style: 'cylinder-tower', height: 187, color: '#9fb7c9' }],
    info: {
      architect: 'Eli Attia (original design)',
      summary: { en: 'The first of the three Azrieli towers, a new landmark of the city’s eastern business district.' },
      sources: [{ label: 'Azrieli Center – Wikipedia', url: W('Azrieli_Center') }],
      confidence: 'approximate',
    },
  },
  {
    id: 'azrieli-triangular',
    name: { en: 'Azrieli Center – Triangular Tower', he: 'מגדלי עזריאלי – המשולש' },
    ...at(32.0741, 34.7932),
    width: 50,
    depth: 50,
    landmark: true,
    phases: [{ from: 1999, style: 'triangle-tower', height: 169, color: '#9fb7c9' }],
    info: { summary: { en: 'The triangular Azrieli tower.' }, sources: [{ label: 'Azrieli Center – Wikipedia', url: W('Azrieli_Center') }], confidence: 'approximate' },
  },
  {
    id: 'azrieli-square',
    name: { en: 'Azrieli Center – Square Tower', he: 'מגדלי עזריאלי – המרובע' },
    ...at(32.0737, 34.7944),
    width: 46,
    depth: 46,
    landmark: true,
    phases: [{ from: 2007, style: 'glass-tower', height: 154, color: '#9fb7c9' }],
    info: { summary: { en: 'The square Azrieli tower, completed last.' }, sources: [{ label: 'Azrieli Center – Wikipedia', url: W('Azrieli_Center') }], confidence: 'approximate' },
  },
  {
    id: 'azrieli-sarona',
    name: { en: 'Azrieli Sarona Tower', he: 'מגדל עזריאלי שרונה' },
    ...at(32.0718, 34.7872, 0.4),
    width: 44,
    depth: 44,
    landmark: true,
    phases: [{ from: 2017, style: 'glass-tower', height: 238, color: '#a8bccb' }],
    info: { summary: { en: 'For several years the tallest building in Israel.' }, sources: [{ label: 'Azrieli Sarona Tower – Wikipedia', url: W('Azrieli_Sarona_Tower') }], confidence: 'approximate' },
  },
];
