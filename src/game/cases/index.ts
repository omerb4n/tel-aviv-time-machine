import type { CaseDef } from '../types';
import { SEASHELL_LOTTERY } from './seashellLottery';
import { VANISHING_SCHOOL } from './vanishingSchool';

/** Every playable case, in order. */
export const CASES: CaseDef[] = [VANISHING_SCHOOL, SEASHELL_LOTTERY];

/** Locked titles shown after the playable cases (the last case's teasers that are not playable yet). */
export const COMING: string[] = CASES[CASES.length - 1].teasers.map((t) => t.en).filter((t) => !CASES.some((c) => c.title.en === t));
