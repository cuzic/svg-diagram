import type {PeopleBand, PeopleOpts, DotsBand, DotsOpts, DotDatum} from '../types/people-dots.ts';
import type {Declares, HandleOf} from '../strict.ts';
import {assertNoReveal, withHandle} from './shared.ts';

// N person icons in a grid, the first `count` emphasized — "76 of 100 people". The others are outlines, so the count reads
// without colour. Pass the total and the count; the grid fills row by row from the top left. No text of its own: put the
// number beside it with stat() / caption().
//   people(100, 76)                       // 10 x 10
//   people(10, 3, {cols: 5, tone: 'danger'})
//   people(100, [35, 47], {tone: 'accent', tone2: 'danger'})  // 35 in tone, the next 47 in tone2, the rest outlines
export function people<const Id extends string = never>(total: number, count: number | readonly [number, number], opts?: PeopleOpts & {id?: Id}): PeopleBand & Declares<Id> & HandleOf<Id>;
export function people(total: number, countIn: number | readonly [number, number], opts: PeopleOpts = {}): PeopleBand {
  assertNoReveal(opts, 'people()');
  if (!Number.isInteger(total) || total < 1 || total > 400) throw new Error(`people(): total must be a whole number from 1 to 400 (got ${total})`);
  const [count, count2] = typeof countIn === 'number' ? [countIn, 0] : countIn;
  if (!Number.isInteger(count) || count < 0 || !Number.isInteger(count2) || count2 < 0 || count + count2 > total) throw new Error(`people(): count must be a whole number from 0 to total (${total}), or [k1, k2] with k1 + k2 <= total (got ${JSON.stringify(countIn)})`);
  const cols = opts.cols ?? (total <= 10 ? total : Math.ceil(Math.sqrt(total)));
  if (!Number.isInteger(cols) || cols < 1 || cols > total) throw new Error(`people(): cols must be a whole number from 1 to total (got ${cols})`);
  const size = opts.size ?? 28, gap = opts.gap ?? 8;
  if (!(size >= 12 && size <= 96)) throw new Error(`people(): size must be from 12 to 96 px (got ${size})`);
  if (!(gap >= 0)) throw new Error(`people(): gap must be >= 0 (got ${gap})`);
  if (opts.align !== undefined && opts.align !== 'left' && opts.align !== 'center') throw new Error(`people(): align must be 'left' or 'center' (got ${opts.align})`);
  for (const k of ['tone', 'tone2', 'rest'] as const) { const v = opts[k]; if (v !== undefined && !['accent', 'danger', 'muted'].includes(v)) throw new Error(`people(): ${k} must be 'accent', 'danger' or 'muted' (got ${v})`); }
  if (opts.side !== undefined) {
    if (typeof opts.side.value !== 'string' || !opts.side.value) throw new Error('people(): side needs a value (the text beside the grid)');
    if (opts.side.size !== undefined && opts.side.size !== 'stat' && opts.side.size !== 'display') throw new Error(`people(): side.size must be 'stat' or 'display' (got ${opts.side.size})`);
    if (opts.side.tone !== undefined && !['accent', 'danger', 'muted'].includes(opts.side.tone)) throw new Error(`people(): side.tone must be 'accent', 'danger' or 'muted' (got ${opts.side.tone})`);
  }
  return withHandle({type: 'people', total, count, cols, size, gap, align: opts.align ?? 'center', tone: opts.tone ?? 'accent', tone2: opts.tone2 ?? ((opts.tone ?? 'accent') === 'danger' ? 'accent' : 'danger'), count2, rest: opts.rest ?? 'muted', ...(opts.side ? {side: opts.side} : {}), alt: opts.alt ?? (count2 ? `${count} + ${count2} / ${total}` : `${count} / ${total}`), ...(opts.id === undefined ? {} : {id: opts.id})}, opts.id);
}
// Dots along a lane (an axis): each value is a dot at its position, dots that would touch pile up (the piles never overlap).
// `zones` mark spans of the lane — a bar on the lane, a label under it, and the tone of the dots inside it — for "the people who
// cannot keep up". Values are in the lane's own units (min .. max, default 0 .. 1).
//   dots([0.1, 0.12, 0.15, 0.5, 0.8], {zones: [{from: 0, to: 0.3, label: 'ついてこれない人'}], lowLabel: '遅い', highLabel: '速い'})
export function dots<const Id extends string = never>(values: readonly DotDatum[], opts?: DotsOpts & {id?: Id}): DotsBand & Declares<Id> & HandleOf<Id>;
export function dots(values: readonly DotDatum[], opts: DotsOpts = {}): DotsBand {
  assertNoReveal(opts, 'dots()');
  if (!Array.isArray(values) || values.length === 0) throw new Error('dots(values) needs at least one value');
  const min = opts.min ?? 0, max = opts.max ?? 1, r = opts.r ?? 10, TONES = ['accent', 'danger', 'muted'];
  if (!Number.isFinite(min) || !Number.isFinite(max) || !(max > min)) throw new Error(`dots(): needs finite min < max (got ${min} .. ${max})`);
  if (!(r >= 2 && r <= 24)) throw new Error(`dots(): r must be from 2 to 24 px (got ${r})`);
  for (const k of ['width', 'height'] as const) { const v = opts[k]; if (v !== undefined && !(v > 0 && Number.isFinite(v))) throw new Error(`dots(): ${k} must be a finite number > 0 (got ${v})`); }
  const list = values.map(v => typeof v === 'number' ? {at: v} : v);
  for (const v of list) {
    if (!Number.isFinite(v.at)) throw new Error(`dots(): a value must be a finite number (got ${v.at})`);
    if (v.at < min || v.at > max) throw new Error(`dots(): ${v.at} is outside the lane (${min} .. ${max})`);
    if ('tone' in v && v.tone !== undefined && !TONES.includes(v.tone)) throw new Error(`dots(): tone must be accent, danger or muted (got ${v.tone})`);
  }
  const zones = (opts.zones ?? []).map(z => ({tone: 'danger' as const, ...z}));
  zones.forEach((z, i) => {
    if (!(z.from >= min && z.to <= max && z.from < z.to)) throw new Error(`dots(): zone "${z.label}" must satisfy ${min} <= from < to <= ${max}`);
    if (!TONES.includes(z.tone)) throw new Error(`dots(): zone tone must be accent, danger or muted (got ${z.tone})`);
    if (!z.label) throw new Error('dots(): a zone needs a label — the colour alone does not say what it marks');
    for (const o of zones.slice(0, i)) if (z.from < o.to && o.from < z.to) throw new Error(`dots(): zones "${o.label}" and "${z.label}" overlap`);
  });
  return withHandle({type: 'dots', dots: list, min, max, lowLabel: opts.lowLabel, highLabel: opts.highLabel, zones, r, width: opts.width, height: opts.height, alt: opts.alt ?? `${list.length} dots`, ...(opts.id === undefined ? {} : {id: opts.id})}, opts.id);
}
