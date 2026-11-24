import {AMOUNT, NUM, items, list, object, oneOf, text, withoutType} from '../spec-kit.ts';
import type {Json} from '../spec-kit.ts';
import {CROSS, notDefined, CONTROL_DATA} from './r6-common.ts';
import type {PartDef} from '../spec-kit.ts';

export function defineControlChartPart<Result>(builder: (chart: never, values: never, opts: never) => Result): PartDef<Result> {
  return {
    type: 'controlChart',
    description: "A control chart (QC): the values in time order, the centre line and the 3-sigma limits worked out from the data; points outside the limits and runs of 7 are marked red. chart: x / mr / c take values; xbar / r take subgroups (2-10 measurements each); p / np / u take samples ({n inspected, d defective or defects}).",
    schema: object({
      type: {const: 'controlChart'},
      chart: {...oneOf('x', 'mr', 'xbar', 'r', 'p', 'np', 'c', 'u'), description: 'x: individual values. mr: their moving range. xbar / r: subgroup means / ranges. p: fraction defective. np: number defective. c: defects. u: defects per unit.'},
      values: {...list({...NUM, description: 'One value per sample, in time order.'}, 100, 2), description: 'For x, mr and c.'},
      subgroups: {...list(list(NUM, 10, 2), 50, 2), description: 'For xbar and r: the measurements of each subgroup, all the same size.'},
      samples: {...list(object({n: {type: 'number', minimum: 1e-9, maximum: 1e12, description: 'How many were inspected (for u: the size of the unit).'}, d: {...AMOUNT, description: 'How many were defective (or defects).'}}, ['n', 'd']), 50, 2), description: 'For p, np and u.'},
      at: {...list(text('A sample name, such as a date or a lot.', 12), 100, 2), description: 'Written under the samples, one per sample (default 1, 2, 3...).'},
      limits: object({cl: NUM, ucl: NUM, lcl: NUM}, [], 'Fixed limits from an earlier stable period, instead of the ones from this data.'),
      xLabel: text('The name of the horizontal axis.', 30),
      yLabel: text('The name of the vertical axis (default by chart).', 30),
      rules: {type: 'boolean', description: 'false: do not mark points that break a rule.'},
      digits: {type: 'integer', minimum: 0, maximum: 4, description: 'Decimals of the limit labels.'},
    }, ['type', 'chart']),
    example: {type: 'controlChart', chart: 'x', values: [10.1, 9.9, 10.0, 10.2, 9.8, 10.0, 10.1, 9.9, 10.3, 10.0, 9.7, 10.1, 10.0, 10.9, 10.0]},
    check(part, at, issues) {
      const want = CONTROL_DATA[part['chart'] as string] as string;
      const given = notDefined(part, ['values', 'subgroups', 'samples']);
      if (!given.includes(want)) issues.push({path: `${at}.${want}`, message: `is required for chart '${String(part['chart'])}'`});
      for (const k of given) if (k !== want) issues.push({path: `${at}.${k}`, message: `is not for chart '${String(part['chart'])}': give ${want}`});
      if (want === 'subgroups' && Array.isArray(part['subgroups'])) {
        const size = (part['subgroups'] as unknown[][])[0]?.length;
        (part['subgroups'] as unknown[][]).forEach((g, i) => { if (g.length !== size) issues.push({path: `${at}.subgroups[${i}]`, message: `has ${g.length} measurements; the first subgroup has ${size}: every subgroup needs the same size`}); });
      }
      if (want === 'values' && part['chart'] === 'c' && Array.isArray(part['values'])) (part['values'] as number[]).forEach((v, i) => { if (!(Number.isInteger(v) && v >= 0)) issues.push({path: `${at}.values[${i}]`, message: 'a count of defects is a whole number 0 or more'}); });
      if (want === 'samples' && Array.isArray(part['samples'])) items(part, 'samples').forEach((s, i) => {
        if (part['chart'] !== 'u' && (s['d'] as number) > (s['n'] as number)) issues.push({path: `${at}.samples[${i}].d`, message: `is more than n (${String(s['n'])}): no more can be defective than were inspected`});
      });
      const n = ((part[want] as unknown[] | undefined) ?? []).length;
      if (Array.isArray(part['at']) && n && (part['at'] as unknown[]).length !== n) issues.push({path: `${at}.at`, message: `has ${(part['at'] as unknown[]).length} names; there are ${n} samples`});
      const lim = part['limits'] as Json | undefined;
      if (lim && typeof lim['cl'] === 'number') {
        if (typeof lim['ucl'] === 'number' && !(lim['ucl'] > lim['cl'])) issues.push({path: `${at}.limits.ucl`, message: `must be above cl (${lim['cl']})`});
        if (typeof lim['lcl'] === 'number' && !(lim['lcl'] < lim['cl'])) issues.push({path: `${at}.limits.lcl`, message: `must be below cl (${lim['cl']})`});
      }
    },
    build(part) {
      const {chart, values, subgroups, samples, ...opts} = withoutType(part);
      return builder(chart as never, (values ?? subgroups ?? samples) as never, {...opts, crossMark: CROSS} as never);
    },
    en: {lang: 'en'},
  };
}
