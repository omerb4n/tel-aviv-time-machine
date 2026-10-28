import type { Collection, SectionId } from '../types';

/** The notebook's sections, in order. */
export const SECTIONS: { id: SectionId; title: string }[] = [
  { id: 'architecture', title: 'Architecture' },
  { id: 'urbanism', title: 'Urbanism' },
  { id: 'culture', title: 'Culture' },
];

/** The notebook's pages. Each opens with what it is about and what to look for. */
export const COLLECTIONS: Collection[] = [
  {
    id: 'white-city',
    section: 'architecture',
    title: { en: 'The White City' },
    intro: {
      en: 'In the 1930s, architects trained in Europe, some at the Bauhaus school, others with Le Corbusier or Erich Mendelsohn, built thousands of plain white buildings here. They adapted modernism to a hot, bright coast. In 2003 UNESCO listed the “White City” as a World Heritage Site. Learn to see its features, and what became of them.',
    },
    start: { en: 'Begin on Rothschild Boulevard, today or in 1936.' },
  },
  {
    id: 'before-white',
    section: 'architecture',
    title: { en: 'Before the White City' },
    intro: {
      en: 'The town began in 1909 as a garden suburb of one- and two-storey houses. In the 1920s a building boom brought the eclectic style, mixing Europe and the East. Most of it was replaced by the White City, but not all.',
    },
    start: { en: 'Begin in 1909 or 1922, near Herzl Street.' },
  },
  {
    id: 'building-city',
    section: 'urbanism',
    title: { en: 'Building a city' },
    intro: {
      en: 'In 1909, 66 families divided a sand dune north of Jaffa into plots and built Ahuzat Bayit, a planned garden suburb. Its streets, its boulevard and its water were laid out on purpose. Then the town outgrew the plan, again and again.',
    },
    start: { en: 'Two old photographs are clipped to this page. Where were they taken?' },
  },
  {
    id: 'city-life',
    section: 'culture',
    title: { en: 'City life' },
    intro: {
      en: 'How Tel Aviv lived: its kiosks and boulevards, its first museum, its places of worship and the public art that tells its story.',
    },
    start: { en: 'Start anywhere. The first kiosk is on the boulevard.' },
  },
];
