import {MAX_NODE_WIDTH, list, object, oneOf, text, withoutType} from '../spec-kit.ts';
import type {PartDef} from '../spec-kit.ts';

export function defineCloudPart<Result>(builder: (boxes: never, opts: never) => Result): PartDef<Result> {
  return {
    type: 'cloud',
    description: 'A Theory of Constraints conflict cloud (evaporating cloud): the common objective A, the needs B and C, and the conflicting wants D and D2. B needs D, C needs D2. List the assumptions behind an arrow, and the injection that makes one false.',
    schema: object({
      type: {const: 'cloud'},
      a: text('The common objective.'),
      b: text('The need that D serves.'),
      c: text('The need that D2 serves.'),
      d: text('One side of the conflict.'),
      d2: text('The other side of the conflict.'),
      assumptions: list(object({
        on: {...oneOf('ab', 'ac', 'bd', 'cd', 'dd'), description: 'The arrow: ab = B to A, ac = C to A, bd = D to B, cd = D2 to C, dd = the conflict between D and D2.'},
        text: text('Written so that it reads as a belief that could be false.'),
        injection: text('A change that makes the assumption false.'),
      }, ['on', 'text']), 12),
      conflictLabel: text('A word on the conflict arrow.', 20),
      maxNodeW: MAX_NODE_WIDTH,
    }, ['type', 'a', 'b', 'c', 'd', 'd2']),
    example: {type: 'cloud', a: '製品を成功させる', b: '品質を確保する', c: '市場機会を逃さない', d: '検証に時間をかける', d2: '早くリリースする', assumptions: [{on: 'bd', text: '品質確保には長い検証が必須だ', injection: '自動テストで検証を短くする'}]},
    check() {},
    build(part) {
      const {a, b, c, d, d2, ...opts} = withoutType(part);
      return builder({a, b, c, d, d2} as never, opts as never);
    },
  };
}
