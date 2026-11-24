import {items, list, object, text} from '../spec-kit.ts';
import type {Json} from '../spec-kit.ts';
import {english, optionsOf, IS_IS_NOT_EN, DIM_EN} from './r4-common.ts';
import type {PartDef} from '../spec-kit.ts';

export function defineIsIsNotPart<Result>(builder: (rows: never, opts: never) => Result): PartDef<Result> {
  return {
    type: 'isIsNot',
    description: "A Kepner-Tregoe IS / IS NOT table: for what, where, when and extent, what the problem IS and what it could be but IS NOT, the distinction between the two, and what changed around that distinction. dim is 'what', 'where', 'when', 'extent' or a heading of your own. At least one row needs a distinction.",
    schema: object({
      type: {const: 'isIsNot'},
      rows: list(object({
        dim: text("'what', 'where', 'when', 'extent', or a heading of your own.", 20),
        is: text('What the problem is.', 60),
        isNot: text('What it could be, but is not.', 60),
        distinct: text('What sets IS apart from IS NOT.', 60),
        change: text('What changed around that distinction.', 60),
      }, ['dim', 'is', 'isNot']), 8, 1),
      title: text('A title bar over the table.', 40),
      dense: {type: 'boolean', description: 'true: tighter rows.'},
    }, ['type', 'rows']),
    example: {type: 'isIsNot', rows: [{dim: 'what', is: 'API A のタイムアウト', isNot: 'API B は正常', distinct: 'A だけ外部の DB を使う', change: '接続設定を変えた'}, {dim: 'when', is: '月曜の朝', isNot: 'ほかの曜日', distinct: '週次バッチの直後'}]},
    en: {lang: 'en', labels: IS_IS_NOT_EN},
    check(part, at, issues) {
      if (items(part, 'rows').every(r => r['distinct'] === undefined)) issues.push({path: `${at}.rows`, message: 'no row has a distinct: name at least one sharp difference between IS and IS NOT'});
    },
    build(part) {
      const {rows, ...opts} = optionsOf(part);
      const list = english(part) ? (rows as Json[]).map(r => ({...r, dim: DIM_EN[r['dim'] as string] ?? r['dim']})) : rows;
      return builder(list as never, opts as never);
    },
  };
}
