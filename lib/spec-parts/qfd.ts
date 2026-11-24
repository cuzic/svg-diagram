import {items, list, object, oneOf, text} from '../spec-kit.ts';
import type {PartDef} from '../spec-kit.ts';

export function defineQfdPart<Result>(builder: (demands: never, characteristics: never, relations: never, opts: never) => Result): PartDef<Result> {
  return {
    type: 'qfd',
    description: 'A quality function deployment (QFD, house of quality without the roof): customer demands as rows, each with its importance, against quality characteristics as columns, with ◎ (strong, 9), ○ (3) or △ (1) where a characteristic serves a demand. Each column gets a score, Σ importance x value, and its share in percent; the top characteristic is marked.',
    schema: object({
      type: {const: 'qfd'},
      demands: list(object({label: text('What the customer wants, in their words.', 40), importance: {type: 'number', minimum: 0, maximum: 10, description: 'How much it matters, usually 1 to 5.'}}, ['label', 'importance']), 12, 1),
      characteristics: list(text('A measurable quality characteristic of the product.', 20), 8, 1),
      relations: list({type: 'array', items: {...oneOf('◎', '○', '△', ''), description: "◎ strong, ○ medium, △ weak, '' none."}, minItems: 1, maxItems: 8, description: 'One per characteristic.'}, 12, 1),
      corner: text('The top-left heading (default 要求品質).', 30),
      title: text('A title bar over the table.', 40),
      highlight: {type: 'boolean', description: 'false: do not mark the top score.'},
    }, ['type', 'demands', 'characteristics', 'relations']),
    example: {type: 'qfd', demands: [{label: '持ちやすい', importance: 5}, {label: '電池が長持ち', importance: 4}, {label: '安い', importance: 3}], characteristics: ['重さ', '電池容量', '部品点数'], relations: [['◎', '△', ''], ['△', '◎', ''], ['', '○', '◎']]},
    en: {corner: 'Customer demand', labels: {importance: 'Importance', score: 'Score', relative: 'Relative %'}},
    check(part, at, issues) {
      const demands = items(part, 'demands').length, chars = items(part, 'characteristics').length, rows = part['relations'] as unknown[][];
      if (rows.length !== demands) issues.push({path: `${at}.relations`, message: `has ${rows.length} rows; there are ${demands} demands`});
      rows.forEach((r, i) => { if (r.length !== chars) issues.push({path: `${at}.relations[${i}]`, message: `has ${r.length} marks; there are ${chars} characteristics`}); });
    },
    build(part) {
      const {type: _t, demands, characteristics, relations, ...opts} = part;
      return builder(demands as never, characteristics as never, relations as never, opts as never);
    },
  };
}
