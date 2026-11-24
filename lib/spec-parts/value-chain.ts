import {EMPHASIS_TONE, list, object, text, withoutType} from '../spec-kit.ts';
import type {PartDef} from '../spec-kit.ts';

export function defineValueChainPart<Result>(builder: (parts: never, opts: never) => Result): PartDef<Result> {
  return {
    type: 'valueChain',
    description: "Porter's value chain: support activities across the top and primary activities along the bottom, with a margin arrow at the right end.",
    schema: object({
      type: {const: 'valueChain'},
      support: list(object({label: text('The activity.', 60), sub: text('What it covers.', 60), tone: EMPHASIS_TONE}, ['label']), 6),
      primary: list(object({label: text('The activity.', 60), sub: text('What it covers.', 60), tone: EMPHASIS_TONE}, ['label']), 8, 1),
      margin: {oneOf: [text('The label of the margin arrow.', 20), {type: 'boolean', enum: [false]}], description: 'The label of the arrow at the right end (default マージン), or false for none.'},
      titles: {type: 'array', items: text('A heading.', 20), minItems: 2, maxItems: 2, description: 'The headings of the support and the primary activities (default 支援活動, 主活動).'},
    }, ['type', 'primary']),
    example: {type: 'valueChain', support: [{label: '全般管理'}, {label: '人事・労務管理'}, {label: '技術開発'}, {label: '調達活動'}], primary: [{label: '購買物流'}, {label: '製造'}, {label: '出荷物流'}, {label: '販売・マーケティング'}, {label: 'サービス'}]},
    check() {},
    build(part) {
      const {support, primary, ...opts} = withoutType(part);
      return builder({...(support === undefined ? {} : {support}), primary} as never, opts as never);
    },
  };
}
