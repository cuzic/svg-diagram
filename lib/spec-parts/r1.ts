// Spec parts of round R1 (see lib/spec.ts): each keeps its schema, example, checks and builder together.
// Charts of numbers: bars, lines, stacked bars, a waterfall, a radar chart and a Pareto chart.
import {bars, lines, pareto, radar, stackedBars, waterfall} from '../dsl-pure.ts';
import {AMOUNT, CHART_TONE, NUM, items, list, object, oneOf, text, withoutType} from '../spec-kit.ts';
import type {Json, JsonSchema, PartDef, SpecIssue} from '../spec-kit.ts';

const UNIT = text("Written after every value, such as '万円', '%' or '件'.", 10);
const BAR_TONE = oneOf('accent', 'danger', 'muted');
const DIR = (what: string): JsonSchema => ({...oneOf('v', 'h'), description: `v: ${what} stand side by side and rise. h: they run left to right, one per row (for long labels).`});

/** Labels that repeat in `list` are reported at the second one. */
function uniqueLabels(entries: readonly Json[], at: string, what: string, issues: SpecIssue[], key = 'label'): void {
  const seen = new Set<unknown>();
  entries.forEach((e, i) => {
    if (seen.has(e[key])) issues.push({path: `${at}[${i}].${key}`, message: `"${String(e[key])}" is used twice (each ${what} needs its own ${key})`});
    seen.add(e[key]);
  });
}
const nums = (v: unknown): number[] => Array.isArray(v) ? v.filter((x): x is number => typeof x === 'number') : [];

export const PARTS_R1: readonly PartDef[] = [
  {
    type: 'bars',
    description: 'A bar chart: one bar per label, such as sales by month or votes by option. Values are 0 or more. dir v (columns) suits a few short labels or a time order; h (rows, the default) suits long labels or a ranking. Reference lines (a target, an average) need dir v.',
    schema: object({
      type: {const: 'bars'},
      data: list(object({label: text('What the bar is.', 30), value: {...AMOUNT, description: 'The value, 0 or more.'}, tone: {...BAR_TONE, description: 'A colour to single the bar out (danger is red).'}}, ['label', 'value']), 30, 1),
      unit: UNIT,
      dir: DIR('the bars'),
      lines: {...list(object({at: {...AMOUNT, description: 'The value the line is drawn at.'}, label: text('The name of the line, such as 目標.', 20), tone: CHART_TONE, dashed: {type: 'boolean', description: 'Default true.'}}, ['at']), 4), description: 'Horizontal reference lines across vertical bars (dir v only).'},
      grid: {type: 'boolean', description: 'true: lines across the plot at each tick.'},
      decimals: {type: 'integer', minimum: 0, maximum: 3, description: 'Decimals of the value labels (default: whole numbers as given, others to 3 significant digits).'},
    }, ['type', 'data']),
    example: {type: 'bars', dir: 'v', unit: '件', data: [{label: '4月', value: 120}, {label: '5月', value: 150}, {label: '6月', value: 95, tone: 'danger'}], lines: [{at: 110, label: '目標'}]},
    check(part, at, issues) {
      const data = items(part, 'data');
      uniqueLabels(data, `${at}.data`, 'bar', issues);
      const values = data.map(d => d['value'] as number);
      if (values.length && values.every(v => v === 0)) issues.push({path: `${at}.data`, message: 'every value is 0: there is nothing to draw'});
      const lines = items(part, 'lines');
      if (lines.length && part['dir'] !== 'v') issues.push({path: `${at}.lines`, message: "reference lines are drawn across vertical bars: add dir: 'v'"});
      const max = Math.max(0, ...values);
      lines.forEach((l, i) => { if ((l['at'] as number) > max) issues.push({path: `${at}.lines[${i}].at`, message: `is ${String(l['at'])}, above the tallest bar (${max}): the axis ends there`}); });
    },
    build(part) {
      const {data, decimals, ...opts} = withoutType(part);
      return bars(data as never, {...opts, ...(decimals === undefined ? {} : {valueFormat: decimals})} as never);
    },
  },
  {
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
      return lines(series as never, {...opts, x: {categories, ...(xLabel === undefined ? {} : {label: xLabel})}, ...(Object.keys(y).length ? {y} : {})} as never);
    },
  },
  {
    type: 'stackedBars',
    description: 'A stacked bar chart: each column is split into parts (the same series in every column), such as sales by product per quarter. The total is written on top. percent: true makes every column 100% and writes shares, for comparing make-up rather than size. Up to 6 series.',
    schema: object({
      type: {const: 'stackedBars'},
      series: list(text('The name of a part, shown in the legend.', 20), 6, 1),
      columns: list(object({label: text('What the column is, such as 2024年.', 20), values: list({...AMOUNT, description: 'One per series, in the order of series; 0 for none.'}, 6, 1)}, ['label', 'values']), 12, 1),
      unit: UNIT,
      percent: {type: 'boolean', description: 'true: every column is 100% and the parts are shares.'},
    }, ['type', 'series', 'columns']),
    example: {type: 'stackedBars', unit: '万円', series: ['製品 A', '製品 B', '保守'], columns: [{label: '第1四半期', values: [120, 80, 40]}, {label: '第2四半期', values: [150, 90, 45]}, {label: '第3四半期', values: [170, 70, 55]}]},
    check(part, at, issues) {
      const series = part['series'] as unknown[], n = series.length;
      series.forEach((s, i) => { if (series.indexOf(s) !== i) issues.push({path: `${at}.series[${i}]`, message: `"${String(s)}" is used twice (each series needs its own name)`}); });
      const cols = items(part, 'columns');
      uniqueLabels(cols, `${at}.columns`, 'column', issues);
      cols.forEach((c, i) => {
        const v = nums(c['values']);
        if (v.length !== n) issues.push({path: `${at}.columns[${i}].values`, message: `has ${v.length} values; there are ${n} series`});
        else if (part['percent'] === true && v.every(x => x === 0)) issues.push({path: `${at}.columns[${i}].values`, message: 'adds up to 0, so it has no shares'});
      });
      if (cols.length && cols.every(c => nums(c['values']).every(x => x === 0))) issues.push({path: `${at}.columns`, message: 'every column is 0: there is nothing to draw'});
    },
    build(part) {
      const {series, columns, ...opts} = withoutType(part);
      const names = series as string[];
      return stackedBars((columns as Json[]).map(c => ({label: c['label'] as string, parts: names.map((s, i) => ({label: s, value: (c['values'] as number[])[i] as number}))})), opts as never);
    },
    en: {totalLabel: 'Total'},
  },
  {
    type: 'waterfall',
    description: "A waterfall chart: how a starting amount becomes an ending one through increases and decreases, such as last year's profit to this year's. The first step is the start (its level); every other step is a change (+ rises, - falls), unless its kind is subtotal or total, which shows the running level (its value may be left out).",
    schema: object({
      type: {const: 'waterfall'},
      steps: list(object({
        label: text('What the step is.', 30),
        value: {...NUM, description: 'The start level, or the change (+/-). A subtotal or total may leave it out.'},
        kind: {...oneOf('start', 'delta', 'subtotal', 'total'), description: 'Default: start for the first step, delta for the rest.'},
        tone: {...CHART_TONE, description: 'Overrides the colour (default: rises accent, falls red, totals dark).'},
      }, ['label']), 16, 2),
      unit: UNIT,
      dir: DIR('the steps'),
      connectors: {type: 'boolean', description: 'false: no lines between the bars.'},
    }, ['type', 'steps']),
    example: {type: 'waterfall', unit: '百万円', steps: [{label: '前年の利益', value: 500}, {label: '売上増', value: 180}, {label: '原価増', value: -90}, {label: '販管費減', value: 30}, {label: '今年の利益', kind: 'total'}]},
    check(part, at, issues) {
      items(part, 'steps').forEach((s, i) => {
        const kind = s['kind'] ?? (i === 0 ? 'start' : 'delta');
        if (kind === 'start' && i !== 0) issues.push({path: `${at}.steps[${i}].kind`, message: "only the first step can be the start: write delta for a change"});
        if ((kind === 'subtotal' || kind === 'total') && i === 0) issues.push({path: `${at}.steps[${i}].kind`, message: `a ${String(kind)} adds up the steps before it, so it cannot be the first step`});
        if ((kind === 'start' || kind === 'delta') && s['value'] === undefined) issues.push({path: `${at}.steps[${i}].value`, message: kind === 'start' ? 'is required: the level the chart starts from' : 'is required: the change (+ or -)'});
      });
    },
    build(part) {
      const {steps, ...opts} = withoutType(part);
      return waterfall(steps as never, opts as never);
    },
  },
  {
    type: 'radar',
    description: 'A radar chart: several scores on axes around a centre, one polygon per series, such as skills of a person or features of products. 3 to 12 axes, 1 to 4 series, each with one value per axis.',
    schema: object({
      type: {const: 'radar'},
      axes: list(text('What is scored, such as 価格.', 16), 12, 3),
      series: list(object({label: text('Who or what is scored.', 20), values: list({...NUM, description: 'One per axis, in the order of axes.'}, 12, 3)}, ['label', 'values']), 4, 1),
      min: {...NUM, description: 'The value at the centre (default 0).'},
      max: {...NUM, description: 'The value at the outer ring, such as 5 for a 5-point score (default: a round number above the largest value).'},
      values: {type: 'boolean', description: 'true: write the value at every point.'},
      unit: UNIT,
    }, ['type', 'axes', 'series']),
    example: {type: 'radar', max: 5, axes: ['価格', '品質', 'サポート', '使いやすさ', '機能'], series: [{label: '自社', values: [4, 3, 5, 4, 3]}, {label: '競合', values: [3, 4, 3, 3, 5]}]},
    check(part, at, issues) {
      const n = items(part, 'axes').length, series = items(part, 'series');
      uniqueLabels(series, `${at}.series`, 'series', issues);
      const lo = (part['min'] as number | undefined) ?? 0, hi = part['max'] as number | undefined;
      if (hi !== undefined && !(hi > lo)) issues.push({path: `${at}.max`, message: `must be above min (${lo})`});
      series.forEach((s, i) => {
        const v = nums(s['values']);
        if (v.length !== n) issues.push({path: `${at}.series[${i}].values`, message: `has ${v.length} values; there are ${n} axes`});
        v.forEach((x, j) => {
          if (x < lo) issues.push({path: `${at}.series[${i}].values[${j}]`, message: `is ${x}, below min (${lo}): set min lower`});
          if (hi !== undefined && x > hi) issues.push({path: `${at}.series[${i}].values[${j}]`, message: `is ${x}, above max (${hi})`});
        });
      });
    },
    build(part) {
      const {axes, series, ...opts} = withoutType(part);
      return radar(axes as never, series as never, opts as never);
    },
  },
  {
    type: 'pareto',
    description: "A Pareto chart: causes or categories as bars from the largest down, with a cumulative-percent line, so the vital few that make up most (80%) stand out. Give the items in any order. top: N keeps the N largest and folds the rest into 'その他' (other).",
    en: {other: 'Other'},
    schema: object({
      type: {const: 'pareto'},
      items: list(object({label: text('The cause or category.', 20), value: {...AMOUNT, description: 'How many or how much, 0 or more.'}}, ['label', 'value']), 20, 2),
      unit: UNIT,
      top: {type: 'integer', minimum: 1, maximum: 15, description: 'Keep the N largest and fold the rest into one last bar.'},
      other: text("The name of the folded bar (default 'その他').", 20),
      guide: {oneOf: [{type: 'integer', minimum: 50, maximum: 95}, {type: 'boolean', enum: [false]}], description: 'The cumulative percent of the dashed guide line (default 80), or false for none.'},
      highlight: {type: 'boolean', description: 'false: one colour for every bar (default: the vital few coloured, the rest muted).'},
    }, ['type', 'items']),
    example: {type: 'pareto', unit: '件', items: [{label: '傷', value: 42}, {label: '汚れ', value: 25}, {label: '欠け', value: 12}, {label: '寸法違い', value: 8}, {label: '色むら', value: 5}]},
    check(part, at, issues) {
      const list = items(part, 'items');
      uniqueLabels(list, `${at}.items`, 'item', issues);
      if (list.length && list.every(i => i['value'] === 0)) issues.push({path: `${at}.items`, message: 'every value is 0: there is nothing to draw'});
      const top = part['top'] as number | undefined;
      if (top !== undefined && top >= list.length) issues.push({path: `${at}.top`, message: `is ${top}, but there are only ${list.length} items: leave top out`});
    },
    build(part) {
      const {items: list, ...opts} = withoutType(part);
      return pareto(list as never, opts as never);
    },
  },
];
