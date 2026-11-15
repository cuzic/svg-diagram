// Spec parts of round R6 (see lib/spec.ts): each keeps its schema, example, checks and builder together.
// QC charts from raw data: a histogram, a scatter diagram, a control chart, a check sheet, range bars and a box plot.
import {boxplot, checkSheet, controlChart, histogram, rangeBars, scatter} from '../dsl-pure.ts';
import {AMOUNT, NUM, items, list, object, oneOf, text, withoutType} from '../spec-kit.ts';
import type {Json, JsonSchema, PartDef, SpecIssue} from '../spec-kit.ts';

const UNIT = text("Written after every value, such as '万円', '%' or 'mm'.", 10);
const COUNT: JsonSchema = {type: 'integer', minimum: 0, maximum: 1_000_000, description: 'A count, a whole number 0 or more.'};
/** The legend's cross: the fonts of a Worker have × but no ✕. */
const CROSS = '×';
/** Raw measurements a chart works its statistics out of. */
const MAX_VALUES = 300;

function uniqueLabels(entries: readonly Json[], at: string, what: string, issues: SpecIssue[]): void {
  const seen = new Set<unknown>();
  entries.forEach((e, i) => {
    if (seen.has(e['label'])) issues.push({path: `${at}[${i}].label`, message: `"${String(e['label'])}" is used twice (each ${what} needs its own label)`});
    seen.add(e['label']);
  });
}
const notDefined = (part: Json, keys: readonly string[]): string[] => keys.filter(k => part[k] !== undefined);

/** The data a control chart takes, by kind of chart. */
const CONTROL_DATA: Record<string, 'values' | 'subgroups' | 'samples'> = {x: 'values', mr: 'values', c: 'values', xbar: 'subgroups', r: 'subgroups', p: 'samples', np: 'samples', u: 'samples'};

export const PARTS_R6: readonly PartDef[] = [
  {
    type: 'histogram',
    description: 'A histogram (QC): the raw measurements are sorted into classes of a round width and drawn as touching bars. Give the specification limits (lsl, usl) to draw them and turn the classes outside red; the mean is drawn by default, the normal curve with normal: true.',
    schema: object({
      type: {const: 'histogram'},
      values: list({...NUM, description: 'One measurement.'}, MAX_VALUES, 2),
      unit: UNIT,
      bins: {type: 'integer', minimum: 3, maximum: 20, description: 'About how many classes (default from the count of values). Not with width.'},
      width: {type: 'number', minimum: 1e-9, maximum: 1e12, description: 'The class width. Not with bins.'},
      lsl: {...NUM, description: 'The lower specification limit.'},
      usl: {...NUM, description: 'The upper specification limit.'},
      target: {...NUM, description: 'The target (nominal) value.'},
      mean: {type: 'boolean', description: 'false: do not draw the mean.'},
      normal: {type: 'boolean', description: 'true: draw the normal curve of the data.'},
    }, ['type', 'values']),
    example: {type: 'histogram', unit: 'mm', lsl: 9.6, usl: 10.4, values: [9.8, 10.1, 10.0, 10.2, 9.9, 10.0, 10.3, 9.7, 10.1, 10.0, 9.9, 10.2, 10.0, 10.1, 9.8, 10.5, 10.0, 9.9, 10.1, 10.0]},
    check(part, at, issues) {
      if (part['bins'] !== undefined && part['width'] !== undefined) issues.push({path: `${at}.width`, message: 'give bins or width, not both'});
      if (typeof part['lsl'] === 'number' && typeof part['usl'] === 'number' && !(part['lsl'] < part['usl'])) issues.push({path: `${at}.usl`, message: `must be above lsl (${part['lsl']})`});
      const v = part['values'] as number[];
      if (v.every(x => x === v[0])) issues.push({path: `${at}.values`, message: 'every value is the same: there is no spread to show'});
      if (typeof part['width'] === 'number') {
        const classes = (Math.max(...v) - Math.min(...v)) / part['width'];
        if (classes > 40) issues.push({path: `${at}.width`, message: `makes about ${Math.ceil(classes)} classes; at most 40 fit`});
      }
    },
    build(part) {
      const {values, ...opts} = withoutType(part);
      return histogram(values as never, opts as never);
    },
    en: {lineWords: {lsl: 'LSL', usl: 'USL', target: 'Target', mean: 'Mean'}},
  },
  {
    type: 'scatter',
    description: 'A scatter diagram (QC): one point per pair of values, to see whether two things move together. Points with a group get a colour and a shape per group (at most 4 groups). regression: true draws the least-squares line and writes the correlation coefficient r.',
    schema: object({
      type: {const: 'scatter'},
      x: text('The name of the horizontal axis, with its unit, such as 温度 (℃).', 30),
      y: text('The name of the vertical axis, with its unit.', 30),
      points: list(object({x: NUM, y: NUM, label: text('Written beside the point (use for a few points only).', 20), group: text('The group (stratum) the point belongs to.', 20)}, ['x', 'y']), 200, 2),
      regression: {type: 'boolean', description: 'true: the least-squares line, r, the equation and n.'},
    }, ['type', 'x', 'y', 'points']),
    example: {type: 'scatter', x: '気温 (℃)', y: '販売数 (個)', regression: true, points: [{x: 18, y: 120}, {x: 21, y: 150}, {x: 24, y: 175}, {x: 27, y: 210}, {x: 30, y: 260}, {x: 33, y: 280}]},
    check(part, at, issues) {
      const pts = items(part, 'points');
      const groups = [...new Set(pts.map(p => p['group']).filter(g => g !== undefined))];
      if (groups.length > 4) issues.push({path: `${at}.points`, message: `has ${groups.length} groups; at most 4 can be told apart`});
      if (groups.length && pts.some(p => p['group'] === undefined)) pts.forEach((p, i) => { if (p['group'] === undefined) issues.push({path: `${at}.points[${i}].group`, message: 'is missing: when some points have a group, every point needs one'}); });
      if (part['regression'] === true) {
        if (pts.length < 3) issues.push({path: `${at}.regression`, message: 'needs at least 3 points'});
        else if (pts.every(p => p['x'] === pts[0]?.['x'])) issues.push({path: `${at}.regression`, message: 'every x is the same: there is no line to fit'});
      }
    },
    build(part) {
      const {points, ...opts} = withoutType(part);
      return scatter(points as never, {...opts, crossMark: CROSS} as never);
    },
    en: {statSeparator: ', '},
  },
  {
    type: 'controlChart',
    description: "A control chart (QC): the values in time order, the centre line and the 3-sigma limits worked out from the data; points outside the limits and runs of 7 are marked red. chart: x / mr / c take values; xbar / r take subgroups (2-10 measurements each); p / np / u take samples ({n inspected, d defective or defects}).",
    schema: object({
      type: {const: 'controlChart'},
      chart: {...oneOf('x', 'mr', 'xbar', 'r', 'p', 'np', 'c', 'u'), description: 'x: individual values. mr: their moving range. xbar / r: subgroup means / ranges. p: fraction defective. np: number defective. c: defects. u: defects per unit.'},
      values: {...list({...NUM, description: 'One value per sample, in time order.'}, 100, 2), description: 'For x, mr and c.'},
      subgroups: {...list(list(NUM, 10, 2), 50, 2), description: 'For xbar and r: the measurements of each subgroup, all the same size.'},
      samples: {...list(object({n: {type: 'number', minimum: 1e-9, maximum: 1e12, description: 'How many were inspected (for u: the size of the unit).'}, d: {...AMOUNT, description: 'How many were defective (or defects).'}}, ['n', 'd']), 50, 2), description: 'For p, np and u.'},
      at: {...list(text('A sample name, such as a date or a lot.', 12), 100, 2), description: 'Written under the samples, one per sample (default 1, 2, 3...).'},
      limits: object({cl: NUM, ucl: NUM, lcl: NUM}, [], 'Fixed limits from an earlier stable period, instead of the ones from this data.'),
      xLabel: text('The name of the horizontal axis.', 30),
      yLabel: text('The name of the vertical axis (default by chart).', 30),
      rules: {type: 'boolean', description: 'false: do not mark points that break a rule.'},
      digits: {type: 'integer', minimum: 0, maximum: 4, description: 'Decimals of the limit labels.'},
    }, ['type', 'chart']),
    example: {type: 'controlChart', chart: 'x', values: [10.1, 9.9, 10.0, 10.2, 9.8, 10.0, 10.1, 9.9, 10.3, 10.0, 9.7, 10.1, 10.0, 10.9, 10.0]},
    check(part, at, issues) {
      const want = CONTROL_DATA[part['chart'] as string] as string;
      const given = notDefined(part, ['values', 'subgroups', 'samples']);
      if (!given.includes(want)) issues.push({path: `${at}.${want}`, message: `is required for chart '${String(part['chart'])}'`});
      for (const k of given) if (k !== want) issues.push({path: `${at}.${k}`, message: `is not for chart '${String(part['chart'])}': give ${want}`});
      if (want === 'subgroups' && Array.isArray(part['subgroups'])) {
        const size = (part['subgroups'] as unknown[][])[0]?.length;
        (part['subgroups'] as unknown[][]).forEach((g, i) => { if (g.length !== size) issues.push({path: `${at}.subgroups[${i}]`, message: `has ${g.length} measurements; the first subgroup has ${size}: every subgroup needs the same size`}); });
      }
      if (want === 'values' && part['chart'] === 'c' && Array.isArray(part['values'])) (part['values'] as number[]).forEach((v, i) => { if (!(Number.isInteger(v) && v >= 0)) issues.push({path: `${at}.values[${i}]`, message: 'a count of defects is a whole number 0 or more'}); });
      if (want === 'samples' && Array.isArray(part['samples'])) items(part, 'samples').forEach((s, i) => {
        if (part['chart'] !== 'u' && (s['d'] as number) > (s['n'] as number)) issues.push({path: `${at}.samples[${i}].d`, message: `is more than n (${String(s['n'])}): no more can be defective than were inspected`});
      });
      const n = ((part[want] as unknown[] | undefined) ?? []).length;
      if (Array.isArray(part['at']) && n && (part['at'] as unknown[]).length !== n) issues.push({path: `${at}.at`, message: `has ${(part['at'] as unknown[]).length} names; there are ${n} samples`});
      const lim = part['limits'] as Json | undefined;
      if (lim && typeof lim['cl'] === 'number') {
        if (typeof lim['ucl'] === 'number' && !(lim['ucl'] > lim['cl'])) issues.push({path: `${at}.limits.ucl`, message: `must be above cl (${lim['cl']})`});
        if (typeof lim['lcl'] === 'number' && !(lim['lcl'] < lim['cl'])) issues.push({path: `${at}.limits.lcl`, message: `must be below cl (${lim['cl']})`});
      }
    },
    build(part) {
      const {chart, values, subgroups, samples, ...opts} = withoutType(part);
      return controlChart(chart as never, (values ?? subgroups ?? samples) as never, {...opts, crossMark: CROSS} as never);
    },
    en: {lang: 'en'},
  },
  {
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
      return checkSheet(rows as never, columns as never, opts as never);
    },
    en: {totalLabel: 'Total', as: 'number'},
  },
  {
    type: 'rangeBars',
    description: 'Range bars: one bar per label from a low to a high value, such as the price range of each plan, an estimate range or a minimum and maximum. Values are 0 or more.',
    schema: object({
      type: {const: 'rangeBars'},
      items: list(object({label: text('What the bar is.', 30), low: {...AMOUNT, description: 'Where the bar starts.'}, high: {...AMOUNT, description: 'Where it ends, above low.'}, tone: oneOf('accent', 'danger', 'muted')}, ['label', 'low', 'high']), 20, 1),
      unit: UNIT,
      dir: {...oneOf('v', 'h'), description: 'h (default): one bar per row. v: side by side.'},
      decimals: {type: 'integer', minimum: 0, maximum: 3, description: 'Decimals of the value labels.'},
    }, ['type', 'items']),
    example: {type: 'rangeBars', unit: '万円', items: [{label: '設計', low: 80, high: 120}, {label: '開発', low: 200, high: 340, tone: 'accent'}, {label: 'テスト', low: 60, high: 110}]},
    check(part, at, issues) {
      const list = items(part, 'items');
      uniqueLabels(list, `${at}.items`, 'bar', issues);
      list.forEach((r, i) => { if (!((r['high'] as number) > (r['low'] as number))) issues.push({path: `${at}.items[${i}].high`, message: `must be above low (${String(r['low'])})`}); });
    },
    build(part) {
      const {items: rows, decimals, ...opts} = withoutType(part);
      return rangeBars((rows as Json[]).map(({low, high, ...r}) => ({...r, range: [low, high]})) as never, {...opts, ...(decimals === undefined ? {} : {valueFormat: decimals})} as never);
    },
    en: {rangeMark: '–'},
  },
  {
    type: 'boxplot',
    description: 'A box plot: the spread of the raw values of each group, the box from the first to the third quartile with the median, whiskers to 1.5 IQR and the values beyond as rings. Compares groups such as branches, lines or months.',
    schema: object({
      type: {const: 'boxplot'},
      groups: list(object({label: text('The group.', 20), values: list(NUM, MAX_VALUES, 3)}, ['label', 'values']), 12, 1),
      label: text('The name of the value axis, with its unit.', 30),
      unit: UNIT,
      dir: {...oneOf('v', 'h'), description: 'v (default): the groups along the bottom. h: down the left.'},
      values: {...oneOf('median', 'mean', 'none'), description: "Write each group's median or mean beside it (default none)."},
      counts: {type: 'boolean', description: 'true: write n = … under each group.'},
      points: {type: 'boolean', description: 'true: draw every value as a point over the boxes.'},
    }, ['type', 'groups']),
    example: {type: 'boxplot', label: '待ち時間 (分)', groups: [{label: '本店', values: [5, 7, 8, 9, 10, 12, 14, 25]}, {label: '駅前店', values: [3, 4, 4, 5, 6, 7, 8, 9]}, {label: '郊外店', values: [8, 10, 11, 13, 15, 16, 18, 20]}]},
    check(part, at, issues) {
      const list = items(part, 'groups');
      uniqueLabels(list, `${at}.groups`, 'group', issues);
      const total = list.reduce((n, g) => n + (g['values'] as unknown[]).length, 0);
      if (total > 1200) issues.push({path: `${at}.groups`, message: `hold ${total} values; the limit is 1200`});
    },
    build(part) {
      const {groups, points, ...opts} = withoutType(part);
      return boxplot(groups as never, {...opts, ...(points === true ? {kind: ['box', 'strip']} : {})} as never);
    },
  },
];
