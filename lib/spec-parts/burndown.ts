import {AMOUNT, count, list, object, text} from '../spec-kit.ts';
import type {PartDef, Json} from '../spec-kit.ts';
import {burndownOpts} from '../charts-lines.ts';
import {MAX_DAYS, axisLabels, renamed} from './r5-common.ts';

export function defineBurndownPart<Result>(builder: (spec: never, opts: never) => Result, lines: (series: never, opts: never) => Result): PartDef<Result> {
  return {
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
      return names ? lines(...renamed(burndownOpts(spec, opts) as never, [names['ideal'] as string, names['actual'] as string])) : builder(spec, opts);
    },
  };
}
