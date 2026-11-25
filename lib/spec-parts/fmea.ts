import {list, object, oneOf, text} from '../spec-kit.ts';
import {optionsOf, FMEA_EN} from './r4-common.ts';
import type {PartDef} from '../spec-kit.ts';

export function defineFmeaPart<Result>(builder: (rows: never, opts: never) => Result): PartDef<Result> {
  return {
    type: 'fmea',
    description: 'An FMEA table (failure mode and effects analysis): for each item, how it can fail, the effect, the cause and the action, rated S (severity), O (occurrence) and D (detection) from 1 to 10. RPN = S x O x D is worked out and coloured against the threshold; `after` gives the ratings once the action is taken.',
    schema: object({
      type: {const: 'fmea'},
      rows: list(object({
        item: text('The part or the process step.', 30),
        mode: text('How it fails.', 40),
        effect: text('What the failure causes.', 40),
        cause: text('Why it fails.', 40),
        action: text('What is done about it.', 40),
        s: {type: 'integer', minimum: 1, maximum: 10, description: 'Severity, 1 to 10.'},
        o: {type: 'integer', minimum: 1, maximum: 10, description: 'Occurrence, 1 to 10.'},
        d: {type: 'integer', minimum: 1, maximum: 10, description: 'Detection, 1 (sure to be found) to 10.'},
        after: object({s: {type: 'integer', minimum: 1, maximum: 10}, o: {type: 'integer', minimum: 1, maximum: 10}, d: {type: 'integer', minimum: 1, maximum: 10}}, ['s', 'o', 'd'], 'The ratings after the action.'),
      }, ['item', 'mode', 'effect', 'cause', 'action', 's', 'o', 'd']), 12, 1),
      title: text('A title bar over the table.', 40),
      sort: {...oneOf('rpn'), description: 'rpn: the highest RPN first.'},
      threshold: {type: 'integer', minimum: 1, maximum: 1000, description: 'An RPN at or above it is red (default 100).'},
      dense: {type: 'boolean', description: 'true: tighter rows.'},
    }, ['type', 'rows']),
    example: {type: 'fmea', rows: [{item: '駆動軸', mode: '摩耗', effect: '搬送が止まる', cause: '潤滑不足', action: '定期給油', s: 8, o: 5, d: 4}]},
    en: {labels: FMEA_EN},
    check() {},
    build(part) {
      const {rows, ...opts} = optionsOf(part);
      return builder(rows as never, opts as never);
    },
  };
}
