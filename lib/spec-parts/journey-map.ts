import {CELL, id, items, list, object, text, uniqueIds, withoutType} from '../spec-kit.ts';
import type {PartDef} from '../spec-kit.ts';

export function defineJourneyMapPart<Result>(builder: (stages: never, lanes: never, opts: never) => Result): PartDef<Result> {
  return {
    type: 'journeyMap',
    description: "A customer journey map: the stages across the top, and rows (lanes) such as actions, touchpoints, feelings and issues. The lane with id 'emotion' holds a number from -2 (bad) to 2 (good) per stage and is drawn as a curve of feelings.",
    schema: object({
      type: {const: 'journeyMap'},
      stages: list(text('A stage.', 20), 8, 2),
      lanes: list(object({id: id('A name for the lane.'), label: text('What the lane holds.', 20), cells: {type: 'array', items: CELL, minItems: 1, maxItems: 8, description: 'One per stage.'}}, ['id', 'label', 'cells']), 8, 1),
      title: text('A title bar.', 40),
      corner: text('The top-left heading.', 30),
    }, ['type', 'stages', 'lanes']),
    example: {type: 'journeyMap', stages: ['認知', '検討', '購入', '利用'], lanes: [{id: 'act', label: '行動', cells: ['広告を見る', '比較する', '申し込む', '使う']}, {id: 'emotion', label: '感情', cells: [0, -1, 1, 2]}, {id: 'issue', label: '課題', cells: ['違いが不明', '送料が不明', '入力が多い', '使い方が不明']}]},
    check(part, at, issues) {
      const n = items(part, 'stages').length;
      uniqueIds(part, 'lanes', at, issues);
      items(part, 'lanes').forEach((l, i) => {
        const cells = l['cells'] as unknown[];
        if (cells.length !== n) issues.push({path: `${at}.lanes[${i}].cells`, message: `has ${cells.length} cells; there are ${n} stages`});
        if (l['id'] === 'emotion') cells.forEach((c, j) => { if (typeof c !== 'number' || c < -2 || c > 2) issues.push({path: `${at}.lanes[${i}].cells[${j}]`, message: 'a feeling is a number from -2 (bad) to 2 (good)'}); });
      });
    },
    build(part) {
      const {stages, lanes, ...opts} = withoutType(part);
      return builder(stages as never, lanes as never, opts as never);
    },
  };
}
