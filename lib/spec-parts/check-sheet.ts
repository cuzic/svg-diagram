import {items, list, object, oneOf, text, withoutType} from '../spec-kit.ts';
import {COUNT, uniqueLabels} from './r6-common.ts';
import type {PartDef} from '../spec-kit.ts';

export function defineCheckSheetPart<Result>(builder: (rows: never, columns: never, opts: never) => Result): PartDef<Result> {
  return {
    type: 'checkSheet',
    description: 'A check sheet (QC): the items (kinds of defect) down the side, the columns (days, machines, shifts) across, and the counts as tally marks with totals. Leave out counts for an empty sheet to fill in by hand.',
    schema: object({
      type: {const: 'checkSheet'},
      columns: list(text('A column, such as a day or a machine.', 12), 12, 1),
      items: list(object({label: text('The item, such as a kind of defect.', 30), counts: {...list(COUNT, 12, 1), description: 'One per column. Leave out for an empty row.'}}, ['label']), 15, 1),
      corner: text('The top-left heading, what the items are.', 20),
      as: {...oneOf('tally', 'number', 'both'), description: 'How a count is written: tally marks (正, the default), digits, or both.'},
      total: {type: 'boolean', description: 'false: no row and column of totals.'},
      boxes: {type: 'boolean', description: 'true: a check box in every empty cell.'},
      title: text('A title bar over the sheet.', 40),
    }, ['type', 'columns', 'items']),
    example: {type: 'checkSheet', corner: '不良の種類', columns: ['月', '火', '水'], items: [{label: '傷', counts: [3, 5, 2]}, {label: '汚れ', counts: [1, 0, 4]}, {label: '欠け', counts: [0, 2, 1]}]},
    check(part, at, issues) {
      const n = items(part, 'columns').length;
      const list = items(part, 'items');
      uniqueLabels(list, `${at}.items`, 'item', issues);
      list.forEach((r, i) => { const c = r['counts'] as unknown[] | undefined; if (c && c.length !== n) issues.push({path: `${at}.items[${i}].counts`, message: `has ${c.length} counts; there are ${n} columns`}); });
      if (part['total'] === true && !list.some(r => r['counts'])) issues.push({path: `${at}.total`, message: 'totals need counts'});
    },
    build(part) {
      const {items: rows, columns, ...opts} = withoutType(part);
      return builder(rows as never, columns as never, opts as never);
    },
    en: {totalLabel: 'Total', as: 'number'},
  };
}
