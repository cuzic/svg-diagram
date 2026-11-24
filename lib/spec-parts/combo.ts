import {CHART_TONE, NUM, items, list, object, oneOf, text, withoutType} from '../spec-kit.ts';
import type {Json} from '../spec-kit.ts';
import type {PartDef} from '../spec-kit.ts';
import {lengthIs, uniqueTexts} from './r5-common.ts';

export function defineComboPart<Result>(builder: (categories: never, series: never, opts: never) => Result): PartDef<Result> {
  return {
    type: 'combo',
    description: 'A combination chart: bars and lines over the same categories, the bars on the left axis and the lines on a right axis of their own, such as sales (bars) and profit margin in % (line). At most 3 bar and 3 line series.',
    schema: object({
      type: {const: 'combo'},
      categories: list(text('A category (a month, a year).', 16), 16, 2),
      series: list(object({
        label: text('The name of the series.', 20),
        type: oneOf('bar', 'line'),
        values: {...list(NUM, 16, 2), description: 'One per category.'},
        axis: {...oneOf('left', 'right'), description: 'A line only: the axis it reads on (default right).'},
        tone: CHART_TONE,
      }, ['label', 'type', 'values']), 6, 1),
      y: object({min: NUM, max: NUM, unit: text('The unit of the left axis.', 8), title: text('Over the left axis (default the unit).', 16)}, [], 'The left axis (the bars).'),
      y2: object({min: NUM, max: NUM, unit: text('The unit of the right axis.', 8), title: text('Over the right axis (default the unit).', 16)}, [], 'The right axis (the lines).'),
      values: {type: 'boolean', description: 'false: do not write the values.'},
      stack: {type: 'boolean', description: 'true: stack the bar series in one column per category (values >= 0).'},
    }, ['type', 'categories', 'series']),
    example: {type: 'combo', categories: ['2023', '2024', '2025'], series: [{label: '売上', type: 'bar', values: [120, 150, 180]}, {label: '利益率', type: 'line', values: [8, 10, 12]}], y: {unit: '億円'}, y2: {unit: '%'}},
    check(part, at, issues) {
      const n = (part['categories'] as unknown[]).length, series = items(part, 'series');
      uniqueTexts(part['categories'] as unknown[], `${at}.categories`, 'category', issues);
      uniqueTexts(series, `${at}.series`, 'series', issues, 'label');
      series.forEach((s, i) => {
        lengthIs(s['values'], n, `${at}.series[${i}].values`, 'categories', issues);
        if (s['type'] === 'bar' && s['axis'] === 'right') issues.push({path: `${at}.series[${i}].axis`, message: 'a bar is always on the left axis (put a line on the right)'});
        if (s['type'] === 'bar' && part['stack'] === true && (s['values'] as number[]).some(v => v < 0)) issues.push({path: `${at}.series[${i}].values`, message: 'stacked bars must not be below 0'});
      });
      for (const t of ['bar', 'line']) if (series.filter(s => s['type'] === t).length > 3) issues.push({path: `${at}.series`, message: `has more than 3 ${t} series: they cannot be told apart`});
      for (const k of ['y', 'y2']) { const a = part[k] as Json | undefined; if (a && typeof a['min'] === 'number' && typeof a['max'] === 'number' && a['min'] >= a['max']) issues.push({path: `${at}.${k}.max`, message: `must be above min (${String(a['min'])})`}); }
    },
    build(part) {
      const {categories, series, ...opts} = withoutType(part);
      return builder(categories as never, series as never, opts as never);
    },
  };
}
