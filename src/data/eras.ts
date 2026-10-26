import type { Era } from './types';

export const TIME_MIN = 1900;
export const TIME_MAX = 2025;

export const ERAS: Era[] = [
  {
    id: 'dunes',
    from: 1900,
    to: 1908,
    title: { en: 'Sands North of Jaffa', he: 'חולות צפונית ליפו' },
    subtitle: { en: 'Neve Tzedek, the railway, and empty dunes' },
    mood: { sepia: 0.7, grain: 0.45, saturation: 0.55, haze: 0.35 },
  },
  {
    id: 'ahuzat-bayit',
    from: 1909,
    to: 1916,
    title: { en: 'Ahuzat Bayit', he: 'אחוזת בית' },
    subtitle: { en: 'A garden suburb rises from the sand' },
    mood: { sepia: 0.6, grain: 0.4, saturation: 0.6, haze: 0.3 },
  },
  {
    id: 'exile',
    from: 1917,
    to: 1918,
    title: { en: 'Exile', he: 'הגירוש' },
    subtitle: { en: 'Ottoman authorities empty the town' },
    mood: { sepia: 0.75, grain: 0.5, saturation: 0.4, haze: 0.4 },
  },
  {
    id: 'eclectic',
    from: 1919,
    to: 1930,
    title: { en: 'The Eclectic Twenties', he: 'שנות העשרים האקלקטיות' },
    subtitle: { en: 'Township, building boom and ornament' },
    mood: { sepia: 0.42, grain: 0.32, saturation: 0.7, haze: 0.25 },
  },
  {
    id: 'white-city',
    from: 1931,
    to: 1947,
    title: { en: 'The White City', he: 'העיר הלבנה' },
    subtitle: { en: 'International Style and the Fifth Aliyah' },
    mood: { sepia: 0.26, grain: 0.26, saturation: 0.75, haze: 0.2 },
  },
  {
    id: 'state',
    from: 1948,
    to: 1964,
    title: { en: 'A State Is Born', he: 'קום המדינה' },
    subtitle: { en: 'Independence, mass immigration, austerity' },
    mood: { sepia: 0.14, grain: 0.22, saturation: 0.85, haze: 0.18 },
  },
  {
    id: 'concrete',
    from: 1965,
    to: 1989,
    title: { en: 'Concrete & Ambition', he: 'בטון ושאפתנות' },
    subtitle: { en: 'Shalom Tower and the move uptown' },
    mood: { sepia: 0.06, grain: 0.16, saturation: 0.9, haze: 0.2 },
  },
  {
    id: 'renewal',
    from: 1990,
    to: 2008,
    title: { en: 'Renewal', he: 'התחדשות' },
    subtitle: { en: 'Restoration, UNESCO and the start-up city' },
    mood: { sepia: 0.02, grain: 0.1, saturation: 1, haze: 0.15 },
  },
  {
    id: 'today',
    from: 2009,
    to: 2025,
    title: { en: 'Tel Aviv Today', he: 'תל אביב היום' },
    subtitle: { en: 'Towers, boulevards and the city that never stops' },
    mood: { sepia: 0, grain: 0.06, saturation: 1.05, haze: 0.12 },
  },
];

export function eraAt(year: number): Era {
  const y = Math.floor(year);
  return ERAS.find((e) => y >= e.from && y <= e.to) ?? ERAS[ERAS.length - 1];
}

/** Era mood blended smoothly between era midpoints (avoids hard jumps at boundaries). */
export function moodAt(year: number): Era['mood'] {
  const keys = ERAS.map((e) => ({ t: (e.from + e.to) / 2, m: e.mood }));
  if (year <= keys[0].t) return keys[0].m;
  for (let i = 1; i < keys.length; i++) {
    if (year <= keys[i].t) {
      const a = keys[i - 1];
      const b = keys[i];
      const k = (year - a.t) / (b.t - a.t);
      return {
        sepia: a.m.sepia + (b.m.sepia - a.m.sepia) * k,
        grain: a.m.grain + (b.m.grain - a.m.grain) * k,
        saturation: a.m.saturation + (b.m.saturation - a.m.saturation) * k,
        haze: a.m.haze + (b.m.haze - a.m.haze) * k,
      };
    }
  }
  return keys[keys.length - 1].m;
}
