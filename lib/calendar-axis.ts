import {must} from './must.ts';

export const MS_DAY = 86400000;

/** 'YYYY' | 'YYYY-MM' | 'YYYY-MM-DD' -> days since the epoch (UTC; a year or month means its first day). Never reads the clock. */
export function timelineDay(at: string, what: string): number {
  const m = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/.exec(String(at));
  if (!m) throw new Error(`timeline(): ${what} must be 'YYYY', 'YYYY-MM' or 'YYYY-MM-DD' (got ${JSON.stringify(at)})`);
  const y = +must(m[1]), mo = m[2] ? +m[2] : 1, d = m[3] ? +m[3] : 1, t = Date.UTC(y, mo - 1, d);
  const back = new Date(t);
  if (back.getUTCFullYear() !== y || back.getUTCMonth() !== mo - 1 || back.getUTCDate() !== d) throw new Error(`timeline(): ${what} is not a real date (${at})`);
  return t / MS_DAY;
}

/** Ticks on the axis: a step of whole months (1, 3, 6, 12, 24, 60) that leaves at most ~8 of them; each tick is a month that is a multiple of the step. */
export function ticksOf(from: number, to: number): {day: number; label: string}[] {
  const a = new Date(from * MS_DAY), months = Math.max(1, (to - from) / 30.4375);
  const step = [1, 3, 6, 12, 24, 60, 120].find(s => months / s <= 8) ?? 120;
  const out: {day: number; label: string}[] = [];
  let y = a.getUTCFullYear(), m = a.getUTCMonth();
  for (let i = 0; i < 2000; i++) {
    const day = Date.UTC(y, m, 1) / MS_DAY;
    if (day > to) break;
    const idx = step >= 12 ? y : y * 12 + m;
    if (day >= from && (step >= 12 ? m === 0 && y % (step / 12) === 0 : idx % step === 0)) out.push({day, label: m === 0 ? `${y}` : `${y}/${m + 1}`});
    if (++m > 11) { m = 0; y++; }
  }
  return out;
}

/** Day-level tick sets for an axis under 2 months, finest first (every day, 2 days, Monday, every other Monday; at most 16 ticks each), labelled 'm/d'; the first tick of a new year carries the year. */
export function fineTickSets(from: number, to: number): {day: number; label: string}[][] {
  if (to - from >= 61) return [];
  const sets: {day: number; label: string}[][] = [];
  for (const [m, r] of [[1, 0], [2, 0], [7, 4], [14, 4]] as const) { // day 0 (1970-01-01) is a Thursday: Mondays are 4 mod 7
    const days: number[] = [];
    for (let d = Math.ceil(from); d <= to; d++) if (((d - r) % m + m) % m === 0) days.push(d);
    if (days.length > 16 || !days.length) continue;
    let year = -1;
    sets.push(days.map(day => {
      const d = new Date(day * MS_DAY), y = d.getUTCFullYear(), label = `${year >= 0 && y !== year ? `${y}/` : ''}${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
      year = y;
      return {day, label};
    }));
  }
  return sets;
}
