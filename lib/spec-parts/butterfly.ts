import {AMOUNT, CHART_TONE, items, list, object, oneOf, text, withoutType} from '../spec-kit.ts';
import type {PartDef} from '../spec-kit.ts';
import {uniqueTexts} from './r5-common.ts';

export function defineButterflyPart<Result>(builder: (rows: never, opts: never) => Result): PartDef<Result> {
  return {
    type: 'butterfly',
    description: 'A butterfly chart: two groups compared row by row, bars running left and right from a shared middle column of labels, such as men and women by age or us and a competitor by criterion.',
    schema: object({
      type: {const: 'butterfly'},
      leftLabel: text('The name of the left group.', 20),
      rightLabel: text('The name of the right group.', 20),
      rows: list(object({label: text('The row.', 20), left: AMOUNT, right: AMOUNT}, ['label', 'left', 'right']), 15, 1),
      unit: text('Written after every value.', 8),
      sort: {...oneOf('given', 'left', 'right'), description: 'The order of the rows: as given (default), or largest first by one side.'},
      leftTone: CHART_TONE,
      rightTone: CHART_TONE,
    }, ['type', 'leftLabel', 'rightLabel', 'rows']),
    example: {type: 'butterfly', leftLabel: '男性', rightLabel: '女性', unit: '人', rows: [{label: '20 代', left: 32, right: 41}, {label: '30 代', left: 45, right: 38}, {label: '40 代', left: 28, right: 30}]},
    check(part, at, issues) {
      uniqueTexts(part['rows'] as unknown[], `${at}.rows`, 'row', issues, 'label');
      if (items(part, 'rows').every(r => r['left'] === 0 && r['right'] === 0)) issues.push({path: `${at}.rows`, message: 'all values are 0'});
    },
    build(part) {
      const {rows, ...opts} = withoutType(part);
      return builder(rows as never, opts as never);
    },
  };
}
