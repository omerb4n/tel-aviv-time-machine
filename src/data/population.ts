import { interpKeys } from '../core/math';
import type { SourceRef } from './types';

/**
 * Population of Tel Aviv (until 1949) / Tel Aviv-Yafo (from the 1950 merger).
 * Census years are exact; others are estimates and are flagged in the UI.
 */
export const POPULATION: { year: number; value: number; kind: 'census' | 'estimate' }[] = [
  { year: 1909, value: 300, kind: 'estimate' },
  { year: 1914, value: 2_000, kind: 'estimate' },
  { year: 1917, value: 200, kind: 'estimate' }, // most residents expelled (April 1917)
  { year: 1919, value: 3_000, kind: 'estimate' },
  { year: 1922, value: 15_185, kind: 'census' },
  { year: 1931, value: 46_101, kind: 'census' },
  { year: 1937, value: 150_000, kind: 'estimate' },
  { year: 1944, value: 166_660, kind: 'estimate' },
  { year: 1950, value: 335_000, kind: 'estimate' }, // after merger with Jaffa
  { year: 1961, value: 386_000, kind: 'census' },
  { year: 1983, value: 327_000, kind: 'census' },
  { year: 2008, value: 393_000, kind: 'census' },
  { year: 2023, value: 475_000, kind: 'estimate' },
];

export const POPULATION_SOURCES: SourceRef[] = [
  {
    label: 'Tel Aviv municipality statistical yearbook (historical tables)',
    url: 'https://www.tel-aviv.gov.il/Transparency/DocLib/2008-מבנה דמוגרפי-לוחות הפרק 1.pdf',
  },
  { label: 'Jewish Virtual Library – Tel Aviv history', url: 'https://www.jewishvirtuallibrary.org/jsource/Society_&_Culture/geo/tahist.html' },
  { label: 'Israel Central Bureau of Statistics', url: 'https://www.cbs.gov.il/en' },
];

const KEYS = POPULATION.map((p) => [p.year, p.value] as const);

export function populationAt(year: number): { value: number; estimated: boolean; label: string } {
  if (year < POPULATION[0].year) return { value: 0, estimated: true, label: 'Neve Tzedek & dunes' };
  const exact = POPULATION.find((p) => p.year === Math.floor(year));
  return {
    value: Math.round(interpKeys(KEYS, year)),
    estimated: !exact || exact.kind === 'estimate',
    label: year < 1950 ? 'Tel Aviv' : 'Tel Aviv-Yafo',
  };
}
