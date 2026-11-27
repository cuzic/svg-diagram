import {AMOUNT, items, list, object, oneOf, text, withoutType} from '../spec-kit.ts';
import type {Json} from '../spec-kit.ts';
import {UNIT, uniqueLabels} from './r6-common.ts';
import type {PartDef} from '../spec-kit.ts';

export function defineRangeBarsPart<Result>(builder: (rows: never, opts: never) => Result): PartDef<Result> {
  return {
    type: 'rangeBars',
    description: 'Range bars: one bar per label from a low to a high value, such as the price range of each plan, an estimate range or a minimum and maximum. Values are 0 or more. With point estimates or a reference line: forest.',
    schema: object({
      type: {const: 'rangeBars'},
      items: list(object({label: text('What the bar is.', 30), low: {...AMOUNT, description: 'Where the bar starts.'}, high: {...AMOUNT, description: 'Where it ends, above low.'}, tone: oneOf('accent', 'danger', 'muted')}, ['label', 'low', 'high']), 20, 1),
      unit: UNIT,
      dir: {...oneOf('v', 'h'), description: 'h (default): one bar per row. v: side by side.'},
      decimals: {type: 'integer', minimum: 0, maximum: 3, description: 'Decimals of the value labels.'},
    }, ['type', 'items']),
    example: {type: 'rangeBars', unit: '万円', items: [{label: '設計', low: 80, high: 120}, {label: '開発', low: 200, high: 340, tone: 'accent'}, {label: 'テスト', low: 60, high: 110}]},
    check(part, at, issues) {
      const list = items(part, 'items');
      uniqueLabels(list, `${at}.items`, 'bar', issues);
      list.forEach((r, i) => { if (!((r['high'] as number) > (r['low'] as number))) issues.push({path: `${at}.items[${i}].high`, message: `must be above low (${String(r['low'])})`}); });
    },
    build(part) {
      const {items: rows, decimals, ...opts} = withoutType(part);
      return builder((rows as Json[]).map(({low, high, ...r}) => ({...r, range: [low, high]})) as never, {...opts, ...(decimals === undefined ? {} : {valueFormat: decimals})} as never);
    },
    en: {rangeMark: '–'},
  };
}
