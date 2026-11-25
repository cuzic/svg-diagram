import {NUM, items, list, object, text, withoutType} from '../spec-kit.ts';
import type {Json} from '../spec-kit.ts';
import {uniqueLabels, nums} from './r1-common.ts';
import type {PartDef} from '../spec-kit.ts';

export function defineLinesPart<Result>(builder: (series: never, opts: never) => Result): PartDef<Result> {
  return {
    type: 'lines',
    description: 'A line chart: how values change over categories in order (months, years, stages), one line per series, each named at its end. Up to 6 series (plus ideal/plan lines, drawn dashed). Values can be negative. Each series has one value per category.',
    schema: object({
      type: {const: 'lines'},
      categories: list(text('A point along x, in order, such as 1月.', 20), 24, 2),
      series: list(object({
        label: text('The name of the line, written at its end.', 30),
        values: list({...NUM, description: 'One value per category.'}, 24, 2),
        ideal: {type: 'boolean', description: 'true: a plan or ideal line: dashed and muted, no markers.'},
        smooth: {type: 'boolean', description: 'true: a smooth curve through the points.'},
      }, ['label', 'values']), 8, 1),
      xLabel: text('The name of the x axis.', 20),
      yLabel: text('The name of the y axis, with the unit, such as 売上（万円）.', 20),
      yMin: {...NUM, description: 'The bottom of the y axis (default: 0, or below the lowest value).'},
      yMax: {...NUM, description: 'The top of the y axis (default: a round number above the highest value).'},
      target: object({at: {...NUM, description: 'The value of the target.'}, label: text('The name of the line, such as 目標.', 20)}, ['at'], 'A horizontal target line.'),
      markers: {type: 'boolean', description: 'false: no marker at every point (only the ends).'},
    }, ['type', 'categories', 'series']),
    example: {type: 'lines', categories: ['1月', '2月', '3月', '4月'], yLabel: '会員数（人）', series: [{label: '新プラン', values: [120, 180, 260, 340]}, {label: '旧プラン', values: [300, 290, 270, 255]}]},
    check(part, at, issues) {
      const n = items(part, 'categories').length, series = items(part, 'series');
      uniqueLabels(series, `${at}.series`, 'series', issues);
      series.forEach((s, i) => { const k = (s['values'] as unknown[]).length; if (k !== n) issues.push({path: `${at}.series[${i}].values`, message: `has ${k} values; there are ${n} categories`}); });
      const real = series.filter(s => s['ideal'] !== true).length;
      if (real > 6) issues.push({path: `${at}.series`, message: `${real} lines are too many to tell apart (at most 6, besides ideal lines)`});
      if (real === 0) issues.push({path: `${at}.series`, message: 'needs at least one line that is not ideal'});
      const lo = part['yMin'] as number | undefined, hi = part['yMax'] as number | undefined;
      if (lo !== undefined && hi !== undefined && !(lo < hi)) issues.push({path: `${at}.yMax`, message: `must be above yMin (${lo})`});
      series.forEach((s, i) => nums(s['values']).forEach((v, j) => {
        if ((lo !== undefined && v < lo) || (hi !== undefined && v > hi)) issues.push({path: `${at}.series[${i}].values[${j}]`, message: `is ${v}, outside the y axis ${lo ?? ''}–${hi ?? ''}`});
      }));
      const t = part['target'] as Json | undefined;
      if (t && ((lo !== undefined && (t['at'] as number) < lo) || (hi !== undefined && (t['at'] as number) > hi))) issues.push({path: `${at}.target.at`, message: 'is outside the y axis'});
    },
    build(part) {
      const {series, categories, xLabel, yLabel, yMin, yMax, ...opts} = withoutType(part);
      const y = {...(yLabel === undefined ? {} : {label: yLabel}), ...(yMin === undefined ? {} : {min: yMin}), ...(yMax === undefined ? {} : {max: yMax})};
      return builder(series as never, {...opts, x: {categories, ...(xLabel === undefined ? {} : {label: xLabel})}, ...(Object.keys(y).length ? {y} : {})} as never);
    },
  };
}
