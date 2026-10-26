import type { BuildingStyle, Localized, SourceRef } from './types';

const W = (title: string) => `https://en.wikipedia.org/wiki/${title}`;

/** Educational blurbs shown when clicking an ordinary (procedural) building. */
export const STYLE_INFO: Partial<Record<BuildingStyle, { name: Localized; period: string; text: Localized; look: string[]; sources?: SourceRef[] }>> = {
  'ottoman-house': {
    name: { en: 'Late-Ottoman garden house', he: 'בית גן מהתקופה העות׳מאנית' },
    period: '1887–1914',
    text: {
      en: 'The first houses of Ahuzat Bayit and Neve Tzedek: one or two storeys, thick plastered walls, wooden shutters and red roof tiles — many imported from Marseille. Each stood in its own garden behind a low wall.',
    },
    look: ['Red tile hip roof', 'Wooden shutters', 'Front garden and low fence'],
    sources: [{ label: 'Ahuzat Bayit – Wikipedia', url: W('Ahuzat_Bayit') }],
  },
  eclectic: {
    name: { en: 'Eclectic style', he: 'הסגנון האקלקטי' },
    period: '1919–1930',
    text: {
      en: 'A 1920s building boom mixed European classicism with “oriental” motifs: arched windows, decorative parapets, small domes and colourful ceramic tiles, often made at the Bezalel workshops.',
    },
    look: ['Arched windows', 'Ornamental parapet', 'Ceramic decoration'],
    sources: [{ label: 'Architecture of Israel – Wikipedia', url: W('Architecture_of_Israel') }],
  },
  bauhaus: {
    name: { en: 'International Style (“Bauhaus”)', he: 'הסגנון הבינלאומי (״באוהאוס״)' },
    period: '1931–1948',
    text: {
      en: 'Architects trained in Europe adapted modernism to the hot, humid coast: long ribbon balconies shade the walls, small “thermometer” windows light the staircase, pilotis lift buildings so the sea breeze can pass and flat roofs became shared terraces. Together they form the UNESCO-listed White City.',
    },
    look: ['Ribbon balconies', 'Rounded corners', 'Pilotis', 'Thermometer stair windows'],
    sources: [
      { label: 'White City (Tel Aviv) – Wikipedia', url: W('White_City_(Tel_Aviv)') },
      { label: 'UNESCO – White City of Tel-Aviv', url: 'https://whc.unesco.org/en/list/1096/' },
    ],
  },
  shikun: {
    name: { en: 'Austerity-era block (shikun)', he: 'שיכון' },
    period: '1949–1965',
    text: {
      en: 'The young state housed hundreds of thousands of immigrants quickly and cheaply. Plain plastered blocks on columns, small balconies, and later rows of solar water heaters on the roof.',
    },
    look: ['Plain plaster', 'Small balconies', 'Rooftop solar water heaters'],
  },
  brutalist: {
    name: { en: 'Late-modern concrete', he: 'בטון מודרניסטי מאוחר' },
    period: '1965–1990',
    text: { en: 'Offices and banks in exposed concrete with deep horizontal sun-shades — confident, heavy and built for cars.' },
    look: ['Exposed concrete', 'Horizontal sun-shades'],
    sources: [{ label: 'Brutalist architecture – Wikipedia', url: W('Brutalist_architecture') }],
  },
  'modern-residential': {
    name: { en: 'Contemporary residential', he: 'מגורים עכשוויים' },
    period: '1990–today',
    text: {
      en: 'Renewal brings white or stone-clad apartment buildings with glass balcony rails — and, under the TAMA 38 programme, extra floors added on top of older buildings.',
    },
    look: ['Glass balcony rails', 'Penthouse setbacks'],
  },
  'glass-tower': {
    name: { en: 'Glass tower', he: 'מגדל זכוכית' },
    period: '2000–today',
    text: { en: 'Residential and office towers clad in glass rise along the boulevards, often behind preserved 1930s buildings.' },
    look: ['Curtain-wall glass', 'Podium and lobby'],
  },
  'jaffa-stone': {
    name: { en: 'Old Jaffa stone house', he: 'בית אבן ביפו העתיקה' },
    period: 'Ottoman era',
    text: { en: 'Densely packed stone houses with flat roofs, small domes and arched openings climbing the hill of the ancient port city.' },
    look: ['Kurkar sandstone', 'Small domes', 'Arched openings'],
    sources: [{ label: 'Jaffa – Wikipedia', url: W('Jaffa') }],
  },
};
