import {AMOUNT, items, list, object, text} from '../spec-kit.ts';
import type {PartDef} from '../spec-kit.ts';
import {lengthIs, uniqueTexts} from './r5-common.ts';
import type {StackedOpts} from '../charts-stacked.ts';

type MekkoOptions = Omit<StackedOpts, 'percent'>;

export function defineMekkoPart<Result>(builder: (columns: never, opts: MekkoOptions) => Result): PartDef<Result> {
  return {
    type: 'mekko',
    description: 'A Mekko (Marimekko) chart: the width of a column is its total and the height of a part its share, so each area is its share of the whole, such as market size by segment and the share of each company in it.',
    schema: object({
      type: {const: 'mekko'},
      series: list(text('A part of every column (a company, a product).', 20), 6, 2),
      columns: list(object({label: text('The column (a segment, a market).', 20), values: {...list(AMOUNT, 6, 2), description: 'One per series.'}}, ['label', 'values']), 8, 2),
      unit: text('Written after every total (億円, %).', 8),
    }, ['type', 'series', 'columns']),
    example: {type: 'mekko', unit: '億円', series: ['A 社', 'B 社', 'その他'], columns: [{label: '法人', values: [40, 25, 15]}, {label: '個人', values: [10, 20, 30]}]},
    check(part, at, issues) {
      const n = (part['series'] as unknown[]).length;
      uniqueTexts(part['series'] as unknown[], `${at}.series`, 'series', issues);
      uniqueTexts(part['columns'] as unknown[], `${at}.columns`, 'column', issues, 'label');
      items(part, 'columns').forEach((c, i) => {
        lengthIs(c['values'], n, `${at}.columns[${i}].values`, 'series', issues);
        if ((c['values'] as number[]).every(v => v === 0)) issues.push({path: `${at}.columns[${i}].values`, message: 'are all 0: a column needs a total to have a width'});
      });
    },
    build(part) {
      const series = part['series'] as string[];
      const columns = items(part, 'columns').map(c => ({label: c['label'], parts: (c['values'] as number[]).map((value, i) => ({label: series[i], value}))}));
      return builder(columns as never, {...(part['unit'] === undefined ? {} : {unit: part['unit'] as string}), ...(part['totalLabel'] === undefined ? {} : {totalLabel: part['totalLabel'] as string}), ...(part['brackets'] === undefined ? {} : {brackets: part['brackets'] as [string, string]})});
    },
    en: {totalLabel: 'Total', brackets: [' (', ')']},
  };
}
