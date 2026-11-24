// Spec parts of round R5 (see lib/spec.ts): each keeps its schema, example, checks and builder together.
// steps, versus, concentric, harvey, compare, burndown, burnup, mekko, butterfly, combo. A burndown / burnup counts days from 0: it never reads a clock.
import {box, burndown, burnup, butterfly, combo, compare, concentric, harvey, lines, mekko, steps} from '../dsl-pure.ts';
import {versus} from '../compose/versus.ts';
import {burndownOpts, burnupOpts} from '../charts-lines.ts';
import {AMOUNT, BOX_TONE, LINE, count, items, list, object, oneOf, text, withoutType} from '../spec-kit.ts';
import type {Json, JsonSchema, PartDef} from '../spec-kit.ts';


/** The `n` of 'parts[n]', to give the bands a part builds ids of their own. */
const partNo = (at: string): string => /\d+/.exec(at)?.[0] ?? '0';

const MAX_DAYS = 60;
const sideItems = (description: string): JsonSchema => ({...list(object({title: text('The point.', 60), body: text('A second, smaller line.', 120), tone: BOX_TONE}, ['title']), 5, 1), description});
const side = (description: string): JsonSchema => object({title: text('The heading of the side.', 40), tone: BOX_TONE, items: sideItems(description)}, ['title', 'items'], description);
const versusSide = (s: Json, id: string): Json => ({id, title: s['title'], ...(s['tone'] === undefined ? {} : {tone: s['tone']}), children: items(s, 'items').map(i => box(i as never))});
/** The series of a burndown / burnup under the names a spec gives (the builder writes them in Japanese). */
function renamed(made: [{label: string}[], Json], names: readonly (string | undefined)[]): [never, never] {
  const [series, opts] = made;
  return [series.map((s, i) => ({...s, label: names[i] ?? s.label})) as never, opts as never];
}
const axisLabels = (part: Json): Json => ({...(part['xLabel'] === undefined ? {} : {x: {label: part['xLabel']}}), ...(part['yLabel'] === undefined ? {} : {y: {label: part['yLabel']}})});

import {defineConcentricPart} from './concentric.ts';
import {defineHarveyPart} from './harvey.ts';
import {defineComparePart} from './compare.ts';
import {defineMekkoPart} from './mekko.ts';
import {defineButterflyPart} from './butterfly.ts';
import {defineComboPart} from './combo.ts';
export const PARTS_R5: readonly PartDef[] = [
  {
    type: 'steps',
    description: 'Things done in order, with no dates: a row of boxes (title, body, tag) joined by arrows, numbered if wanted, one of them emphasised, and arrows back to earlier steps (loopBack) for rework.',
    schema: object({
      type: {const: 'steps'},
      items: list(object({title: text('The step.', 30), body: text('A second, smaller line.', 80), tag: text('A short tag on the corner.', 12), tone: BOX_TONE}, ['title']), 6, 2),
      numbered: {type: 'boolean', description: 'true: number the steps 1, 2, 3.'},
      highlight: count('The step to emphasise, from 1.', 6),
      highlightTone: oneOf('danger', 'accent'),
      loopBack: list(object({from: count('The later step the arrow leaves, from 1.', 6), to: count('The earlier step it returns to, from 1.', 6), label: text('The text on the arrow.', 20), line: LINE}, ['from', 'to']), 3),
    }, ['type', 'items']),
    example: {type: 'steps', numbered: true, items: [{title: '申請'}, {title: '審査'}, {title: '承認'}, {title: '実行'}], loopBack: [{from: 3, to: 1, label: '差し戻し'}]},
    check(part, at, issues) {
      const n = items(part, 'items').length;
      if (typeof part['highlight'] === 'number' && part['highlight'] > n) issues.push({path: `${at}.highlight`, message: `is step ${part['highlight']}, but there are ${n} steps`});
      items(part, 'loopBack').forEach((l, i) => {
        for (const k of ['from', 'to']) if ((l[k] as number) > n) issues.push({path: `${at}.loopBack[${i}].${k}`, message: `is step ${String(l[k])}, but there are ${n} steps`});
        if ((l['from'] as number) <= (l['to'] as number)) issues.push({path: `${at}.loopBack[${i}]`, message: 'goes back: from must be a later step than to'});
      });
    },
    build(part) {
      const {items: list, ...opts} = withoutType(part);
      return steps(list as never, opts as never);
    },
    en: {stepWord: 'Step'},
  },
  {
    type: 'versus',
    description: 'Two sides compared in two framed columns, such as before and after, the usual view and the real cause, or plan A and plan B. A third frame under both (shared) can show what they have in common, joined to each side by an arrow.',
    schema: object({
      type: {const: 'versus'},
      left: side('The left side.'),
      right: side('The right side.'),
      shared: object({title: text('The heading.', 40), tone: BOX_TONE, items: sideItems('What both sides share.'), leftLabel: text('The text on the arrow from the left side.', 20), rightLabel: text('The text on the arrow from the right side.', 20)}, ['title', 'items'], 'A frame under both sides, joined to each.'),
    }, ['type', 'left', 'right']),
    example: {type: 'versus', left: {title: '導入前', tone: 'muted', items: [{title: '紙で申請する'}, {title: '承認に 3 日かかる'}]}, right: {title: '導入後', tone: 'accent', items: [{title: 'スマホで申請する'}, {title: '当日中に承認される'}]}},
    check() {},
    build(part, at) {
      const n = partNo(at), sh = part['shared'] as Json | undefined;
      const left = versusSide(part['left'] as Json, `vs${n}-left`), right = versusSide(part['right'] as Json, `vs${n}-right`);
      if (!sh) return versus(left as never, right as never);
      const labels = {...(sh['leftLabel'] === undefined ? {} : {left: sh['leftLabel']}), ...(sh['rightLabel'] === undefined ? {} : {right: sh['rightLabel']})};
      return versus(left as never, right as never, {shared: versusSide(sh, `vs${n}-shared`) as never, ...(Object.keys(labels).length ? {connectLabels: labels} : {})});
    },
  },
  defineConcentricPart<ReturnType<typeof concentric>>(concentric),
  defineHarveyPart<ReturnType<typeof harvey>>(harvey),
  defineComparePart<ReturnType<typeof compare>>(compare),
  {
    type: 'burndown',
    description: 'A burndown chart: the work left at the end of each day of a sprint, against the ideal straight line from the total to 0. Days count from 0 (the start); give actual values only for the days reached so far.',
    schema: object({
      type: {const: 'burndown'},
      total: {...AMOUNT, description: 'The work at the start (points, hours, tickets).'},
      days: count('The length of the period in days.', MAX_DAYS),
      actual: {...list(AMOUNT, MAX_DAYS + 1, 1), description: 'The work left at the end of day 0, 1, 2 ... (only the days reached).'},
      names: object({ideal: text('The ideal line.', 16), actual: text('The actual line.', 16)}, [], 'The names of the two lines (default 理想, 実績).'),
      xLabel: text('The x axis (default 日).', 16),
      yLabel: text('The y axis (default 残り).', 16),
    }, ['type', 'total', 'days', 'actual']),
    example: {type: 'burndown', total: 40, days: 10, actual: [40, 38, 35, 35, 30, 26, 22]},
    en: {names: {ideal: 'Ideal', actual: 'Actual'}, xLabel: 'Day', yLabel: 'Remaining'},
    check(part, at, issues) {
      const days = part['days'] as number, n = (part['actual'] as unknown[]).length;
      if (n > days + 1) issues.push({path: `${at}.actual`, message: `has ${n} values; days 0 to ${days} have ${days + 1}`});
    },
    build(part) {
      const spec = {total: part['total'], days: part['days'], actual: part['actual']} as never, opts = axisLabels(part) as never, names = part['names'] as Json | undefined;
      return names ? lines(...renamed(burndownOpts(spec, opts) as never, [names['ideal'] as string, names['actual'] as string])) : burndown(spec, opts);
    },
  },
  {
    type: 'burnup',
    description: 'A burnup chart: the work done by the end of each day climbing towards the scope, which can be one number or grow day by day. Days count from 0 (the start); give done values only for the days reached so far.',
    schema: object({
      type: {const: 'burnup'},
      scope: {oneOf: [AMOUNT, list(AMOUNT, MAX_DAYS + 1, 2)], description: 'The total work: one number, or the scope at the end of each day from day 0 (it may grow).'},
      days: count('The length of the period in days.', MAX_DAYS),
      done: {...list(AMOUNT, MAX_DAYS + 1, 1), description: 'The work done by the end of day 0, 1, 2 ... (only the days reached).'},
      names: object({scope: text('The scope line.', 16), done: text('The done line.', 16)}, [], 'The names of the two lines (default スコープ, 完了).'),
      xLabel: text('The x axis (default 日).', 16),
      yLabel: text('The y axis (default 完了).', 16),
    }, ['type', 'scope', 'days', 'done']),
    example: {type: 'burnup', scope: [30, 30, 30, 34, 34, 36, 36], days: 10, done: [0, 4, 7, 11, 14, 18, 21]},
    en: {names: {scope: 'Scope', done: 'Done'}, xLabel: 'Day', yLabel: 'Done'},
    check(part, at, issues) {
      const days = part['days'] as number;
      for (const k of ['scope', 'done']) {
        const v = part[k];
        if (Array.isArray(v) && v.length > days + 1) issues.push({path: `${at}.${k}`, message: `has ${v.length} values; days 0 to ${days} have ${days + 1}`});
      }
    },
    build(part) {
      const spec = {scope: part['scope'], days: part['days'], done: part['done']} as never, opts = axisLabels(part) as never, names = part['names'] as Json | undefined;
      return names ? lines(...renamed(burnupOpts(spec, opts) as never, [names['scope'] as string, names['done'] as string])) : burnup(spec, opts);
    },
  },
  defineMekkoPart<ReturnType<typeof mekko>>(mekko),
  defineButterflyPart<ReturnType<typeof butterfly>>(butterfly),
  defineComboPart<ReturnType<typeof combo>>(combo),
];
