import {list, object, oneOf, text, withoutType} from '../spec-kit.ts';
import type {Json} from '../spec-kit.ts';
import type {PartDef} from '../spec-kit.ts';
import {lengthIs, uniqueTexts} from './r5-common.ts';

export function defineComparePart<Result>(builder: (rows: never, cols: never, cells: never, opts: never) => Result): PartDef<Result> {
  return {
    type: 'compare',
    description: 'A comparison table (比較表): options (columns) rated on criteria (rows), each cell a mark (◎ best, ○ good, △ fair, × poor) and the reason for it, set side by side so the marks read down a column and every rating says why. A cell that is not rated has the mark - (a dash). Use it to compare plans, products or vendors with reasons; for marks alone use matrix, for filled circles harvey.',
    schema: object({
      type: {const: 'compare'},
      rows: list(text('A criterion.', 30), 12, 1),
      cols: {...list(text('An option.', 20), 6, 1), description: 'The options, at most 6. With more, put the options as rows and the criteria as columns (when there are at most 6 of them), or split into two figures.'},
      cells: list({type: 'array', items: object({
        mark: {...oneOf('◎', '○', '△', '×', '-'), description: "◎ best, ○ good, △ fair, × poor; '-' not rated (drawn as a dash, with no note)."},
        note: text('Why: the reason for the mark, in a phrase.', 40),
      }, ['mark']), minItems: 1, maxItems: 6, description: 'One per column, in the order of cols.'}, 12, 1),
      corner: text('The top-left heading (what the rows are, such as 比較軸).', 20),
    }, ['type', 'rows', 'cols', 'cells']),
    example: {type: 'compare', corner: '比較軸', rows: ['コスト', '拡張性', '導入の早さ'], cols: ['クラウド', '自社運用'], cells: [[{mark: '○', note: '初期費用がない'}, {mark: '×', note: '機器の購入が要る'}], [{mark: '◎', note: '負荷に合わせて増やせる'}, {mark: '△', note: '増設に数週間'}], [{mark: '○', note: '契約後すぐ'}, {mark: '-'}]]},
    check(part, at, issues) {
      const rows = part['rows'] as unknown[], cols = part['cols'] as unknown[], cells = part['cells'] as unknown[];
      uniqueTexts(rows, `${at}.rows`, 'row', issues);
      uniqueTexts(cols, `${at}.cols`, 'column', issues);
      if (cells.length !== rows.length) issues.push({path: `${at}.cells`, message: `has ${cells.length} rows; there are ${rows.length} rows`});
      cells.forEach((r, i) => {
        lengthIs(r, cols.length, `${at}.cells[${i}]`, 'columns', issues);
        (r as Json[]).forEach((c, j) => {
          if (c['mark'] === '-' && c['note'] !== undefined) issues.push({path: `${at}.cells[${i}][${j}].note`, message: "a cell that is not rated ('-') has no note"});
          if (c['mark'] !== '-' && !c['note']) issues.push({path: `${at}.cells[${i}][${j}].note`, message: 'is required: every rating says why'});
        });
      });
    },
    build(part) {
      const {rows, cols, cells, ...opts} = withoutType(part);
      const tuples = (cells as {mark: string; note?: string}[][]).map(r => r.map(c => c.mark === '-' ? null : [c.mark, c.note ?? ''] as const));
      return builder(rows as never, cols as never, tuples as never, opts as never);
    },
  };
}
