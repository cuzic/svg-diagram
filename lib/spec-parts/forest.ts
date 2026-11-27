import {isNum, positive} from './r2-common.ts';
import {NUM, items, list, object, oneOf, text, withoutType} from '../spec-kit.ts';
import type {PartDef} from '../spec-kit.ts';


export function defineForestPart<Result>(builder: (rows: never, opts: never) => Result): PartDef<Result> {
  return {
    type: 'forest',
    description: 'A forest plot: one row per study or group with its point estimate and interval (a confidence interval, for example), a reference line (1 = no difference), and the numbers in a column on the right. A ratio (odds, hazard, risk) is on a log scale by default; for a difference write scale: linear (the reference is then 0). Rows may be headings (a group name) and one row may be the pooled estimate (summary: true, drawn as a diamond). Use this, not rangeBars, when each row has a point estimate or the figure needs a reference line.',
    schema: object({
      type: {const: 'forest'},
      rows: list(object({
        heading: text('A heading row (a group name): this row has no numbers, so write no other field in it.', 40),
        label: text('The study or group of this row.', 40),
        estimate: {...NUM, description: 'The point estimate (the square).'},
        low: {...NUM, description: 'The lower end of the interval.'},
        high: {...NUM, description: 'The upper end of the interval.'},
        weight: {...NUM, minimum: 0, description: 'Optional, above 0 (0 is refused): the size of the square follows the weight (its area is about proportional).'},
        summary: {type: 'boolean', description: 'true: the pooled estimate, drawn as a diamond (no weight).'},
        id: text('Optional: the id a connector or a spotlight can point at.', 40),
      }, []), 40, 1),
      scale: oneOf('log', 'linear'),
      ref: {...NUM, description: 'The reference line: 1 on a log scale (default), 0 on a linear scale (default).'},
      decimals: {type: 'integer', minimum: 0, maximum: 3, description: 'Digits of the numbers in the right-hand column (default 2). A cell with a value too small for them (under half of the last digit) is written with two significant digits of its smallest value, so it can have more digits.'},
      values: {type: 'boolean', description: 'false: no number column.'},
      valueHeader: text('The heading of the number column, such as "OR (95% CI)".', 20),
      axisLabel: text('The title of the axis, such as "オッズ比(対数目盛)".', 30),
      favours: list(text('The side each end of the axis favours.', 20), 2, 2),
      domain: list(NUM, 2, 2),
    }, ['type', 'rows']),
    example: {type: 'forest', valueHeader: 'OR (95% CI)', axisLabel: 'オッズ比(対数目盛)', favours: ['従来が良い', '新方式が良い'], rows: [
      {heading: '東の地域'},
      {label: '拠点 A', estimate: 1.54, low: 1.22, high: 1.95, weight: 180},
      {label: '拠点 B', estimate: 1.31, low: 0.98, high: 1.75, weight: 140},
      {heading: '西の地域'},
      {label: '拠点 C', estimate: 0.92, low: 0.61, high: 1.39, weight: 70},
      {label: '拠点 D', estimate: 1.4, low: 1.1, high: 1.78, weight: 200},
      {label: '全体(統合)', estimate: 1.29, low: 1.12, high: 1.49, summary: true},
    ]},
    check(part, at, issues) {
      const bad = (i: number, message: string) => issues.push({path: `${at}.rows[${i}]`, message});
      items(part, 'rows').forEach((row, i) => {
        const keys = Object.keys(row);
        if ('heading' in row) { if (keys.length > 1) bad(i, 'a heading row holds only "heading": move the numbers to a study row with "label"'); return; }
        for (const key of ['label', 'estimate', 'low', 'high']) if (!(key in row)) bad(i, `a study row needs "${key}" (or write only "heading" for a heading row)`);
        if (row['summary'] === true && 'weight' in row) bad(i, 'the pooled (summary) row has no weight: remove it');
        const [e, lo, hi] = [row['estimate'], row['low'], row['high']] as number[];
        if (typeof e === 'number' && typeof lo === 'number' && typeof hi === 'number' && !(lo <= e && e <= hi)) bad(i, 'low <= estimate <= high does not hold: swap low and high, or fix the estimate');
      });
      const log = part['scale'] !== 'linear';
      items(part, 'rows').forEach((row, i) => {
        positive(row['weight'], `${at}.rows[${i}].weight`, 'a weight', issues);
        if (!log) for (const k of ['estimate', 'low', 'high']) if (isNum(row[k]) && row[k] !== 0 && Math.abs(row[k] as number) < 1e-15) issues.push({path: `${at}.rows[${i}].${k}`, message: `${row[k]} is too small to write (below 1e-15): rescale the unit, for example to thousandths`});
        if (log && isNum(row['low']) && row['low'] < 1e-6) issues.push({path: `${at}.rows[${i}].low`, message: `${row['low']} is below 0.000001: a log scale needs values of 0.000001 or more (for differences write scale: linear)`});
      });
      if (log && isNum(part['ref']) && part['ref'] < 1e-6) issues.push({path: `${at}.ref`, message: 'a log scale needs a ref of 0.000001 or more'});
      const domain = part['domain'] as unknown[] | undefined;
      if (domain && isNum(domain[0]) && isNum(domain[1])) {
        if (!(domain[0] < domain[1])) issues.push({path: `${at}.domain`, message: 'must be [lo, hi] with lo < hi'});
        else if (log && domain[0] < 1e-6) issues.push({path: `${at}.domain`, message: 'a log scale needs a domain starting at 0.000001 or more'});
      }
      if (part['values'] === false && part['valueHeader']) issues.push({path: `${at}.valueHeader`, message: 'the number column is off (values: false): remove valueHeader'});
      const seen = new Set<unknown>();
      items(part, 'rows').forEach((row, i) => { if (row['id'] !== undefined && seen.has(row['id'])) issues.push({path: `${at}.rows[${i}].id`, message: `the id "${String(row['id'])}" is used twice`}); seen.add(row['id']); });
      if (!items(part, 'rows').some(r => !('heading' in r))) issues.push({path: `${at}.rows`, message: 'needs at least one row with an estimate (every row is a heading)'});
    },
    build(part) {
      const {rows, ...opts} = withoutType(part);
      return builder(rows as never, opts as never);
    },
  };
}
