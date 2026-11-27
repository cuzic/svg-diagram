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
        weight: {...NUM, minimum: 0, description: 'Optional, above 0: the size of the square follows the weight (its area is about proportional).'},
        summary: {type: 'boolean', description: 'true: the pooled estimate, drawn as a diamond (no weight).'},
        id: text('Optional: the id a connector or a spotlight can point at.', 40),
      }, []), 40, 1),
      scale: oneOf('log', 'linear'),
      ref: {...NUM, description: 'The reference line: 1 on a log scale (default), 0 on a linear scale (default).'},
      decimals: {type: 'integer', minimum: 0, maximum: 3, description: 'Digits of the numbers in the right-hand column (default 2).'},
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
      if (!items(part, 'rows').some(r => !('heading' in r))) issues.push({path: `${at}.rows`, message: 'needs at least one row with an estimate (every row is a heading)'});
    },
    build(part) {
      const {rows, ...opts} = withoutType(part);
      return builder(rows as never, opts as never);
    },
  };
}
