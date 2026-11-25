import {AMOUNT, count, list, object, text} from '../spec-kit.ts';
import type {PartDef, Json} from '../spec-kit.ts';
import {burnupOpts} from '../charts-lines.ts';
import {MAX_DAYS, axisLabels, renamed} from './r5-common.ts';

export function defineBurnupPart<Result>(builder: (spec: never, opts: never) => Result, lines: (series: never, opts: never) => Result): PartDef<Result> {
  return {
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
      return names ? lines(...renamed(burnupOpts(spec, opts) as never, [names['scope'] as string, names['done'] as string])) : builder(spec, opts);
    },
  };
}
