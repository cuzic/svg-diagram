// Spec parts of round R5 (see lib/spec.ts): each keeps its schema, example, checks and builder together.
// steps, versus, concentric, harvey, compare, burndown, burnup, mekko, butterfly, combo. A burndown / burnup counts days from 0: it never reads a clock.
import {box, burndown, burnup, butterfly, combo, compare, concentric, harvey, lines, mekko, steps, versus} from '../dsl-pure.ts';
import {burndownOpts, burnupOpts} from '../charts-lines.ts';
import {AMOUNT, BOX_TONE, CHART_TONE, LINE, NUM, TEXT_TONE, count, items, list, object, oneOf, text, withoutType} from '../spec-kit.ts';
import type {Json, JsonSchema, PartDef, SpecIssue} from '../spec-kit.ts';

/** Each value of `part[key]` once; a repeat is reported where it is. */
function uniqueTexts(values: readonly unknown[], at: string, what: string, issues: SpecIssue[], key?: string): void {
  const seen = new Set<unknown>();
  values.forEach((v, i) => {
    const x = key === undefined ? v : (v as Json)[key];
    if (seen.has(x)) issues.push({path: `${at}[${i}]${key === undefined ? '' : `.${key}`}`, message: `${JSON.stringify(x)} is used twice (each ${what} needs its own name)`});
    seen.add(x);
  });
}
const lengthIs = (v: unknown, n: number, path: string, what: string, issues: SpecIssue[]): void => {
  if (Array.isArray(v) && v.length !== n) issues.push({path, message: `has ${v.length} values; there are ${n} ${what}`});
};
/** The `n` of 'parts[n]', to give the bands a part builds ids of their own. */
const partNo = (at: string): string => /\d+/.exec(at)?.[0] ?? '0';

const MAX_DAYS = 60;
const sideItems = (description: string): JsonSchema => ({...list(object({title: text('The point.', 60), body: text('A second, smaller line.', 120), tone: BOX_TONE}, ['title']), 5, 1), description});
const side = (description: string): JsonSchema => object({title: text('The heading of the side.', 40), tone: BOX_TONE, items: sideItems(description)}, ['title', 'items'], description);
const versusSide = (s: Json, id: string): Json => ({id, title: s['title'], ...(s['tone'] === undefined ? {} : {tone: s['tone']}), children: items(s, 'items').map(i => box(i as never))});
/** The series of a burndown / burnup under the names a spec gives (the builder writes them in Japanese). */
function renamed(made: [{label: string}[], Json], names: readonly (string | undefined)[]): [never, never] {
  const [series, opts] = made;
  return [series.map((s, i) => ({...s, label: names[i] ?? s.label})) as never, opts as never];
}
const axisLabels = (part: Json): Json => ({...(part['xLabel'] === undefined ? {} : {x: {label: part['xLabel']}}), ...(part['yLabel'] === undefined ? {} : {y: {label: part['yLabel']}})});

export const PARTS_R5: readonly PartDef[] = [
  {
    type: 'steps',
    description: 'Things done in order, with no dates: a row of boxes (title, body, tag) joined by arrows, numbered if wanted, one of them emphasised, and arrows back to earlier steps (loopBack) for rework.',
    schema: object({
      type: {const: 'steps'},
      items: list(object({title: text('The step.', 30), body: text('A second, smaller line.', 80), tag: text('A short tag on the corner.', 12), tone: BOX_TONE}, ['title']), 6, 2),
      numbered: {type: 'boolean', description: 'true: number the steps 1, 2, 3.'},
      highlight: count('The step to emphasise, from 1.', 6),
      highlightTone: oneOf('danger', 'accent'),
      loopBack: list(object({from: count('The later step the arrow leaves, from 1.', 6), to: count('The earlier step it returns to, from 1.', 6), label: text('The text on the arrow.', 20), line: LINE}, ['from', 'to']), 3),
    }, ['type', 'items']),
    example: {type: 'steps', numbered: true, items: [{title: '申請'}, {title: '審査'}, {title: '承認'}, {title: '実行'}], loopBack: [{from: 3, to: 1, label: '差し戻し'}]},
    check(part, at, issues) {
      const n = items(part, 'items').length;
      if (typeof part['highlight'] === 'number' && part['highlight'] > n) issues.push({path: `${at}.highlight`, message: `is step ${part['highlight']}, but there are ${n} steps`});
      items(part, 'loopBack').forEach((l, i) => {
        for (const k of ['from', 'to']) if ((l[k] as number) > n) issues.push({path: `${at}.loopBack[${i}].${k}`, message: `is step ${String(l[k])}, but there are ${n} steps`});
        if ((l['from'] as number) <= (l['to'] as number)) issues.push({path: `${at}.loopBack[${i}]`, message: 'goes back: from must be a later step than to'});
      });
    },
    build(part) {
      const {items: list, ...opts} = withoutType(part);
      return steps(list as never, opts as never);
    },
    en: {stepWord: 'Step'},
  },
  {
    type: 'versus',
    description: 'Two sides compared in two framed columns, such as before and after, the usual view and the real cause, or plan A and plan B. A third frame under both (shared) can show what they have in common, joined to each side by an arrow.',
    schema: object({
      type: {const: 'versus'},
      left: side('The left side.'),
      right: side('The right side.'),
      shared: object({title: text('The heading.', 40), tone: BOX_TONE, items: sideItems('What both sides share.'), leftLabel: text('The text on the arrow from the left side.', 20), rightLabel: text('The text on the arrow from the right side.', 20)}, ['title', 'items'], 'A frame under both sides, joined to each.'),
    }, ['type', 'left', 'right']),
    example: {type: 'versus', left: {title: '導入前', tone: 'muted', items: [{title: '紙で申請する'}, {title: '承認に 3 日かかる'}]}, right: {title: '導入後', tone: 'accent', items: [{title: 'スマホで申請する'}, {title: '当日中に承認される'}]}},
    check() {},
    build(part, at) {
      const n = partNo(at), sh = part['shared'] as Json | undefined;
      const left = versusSide(part['left'] as Json, `vs${n}-left`), right = versusSide(part['right'] as Json, `vs${n}-right`);
      if (!sh) return versus(left as never, right as never);
      const labels = {...(sh['leftLabel'] === undefined ? {} : {left: sh['leftLabel']}), ...(sh['rightLabel'] === undefined ? {} : {right: sh['rightLabel']})};
      return versus(left as never, right as never, {shared: versusSide(sh, `vs${n}-shared`) as never, ...(Object.keys(labels).length ? {connectLabels: labels} : {})});
    },
  },
  {
    type: 'concentric',
    description: 'Concentric circles: layers around a centre, such as stakeholders by distance, defence in depth or a core and its surroundings. labels: side writes each ring\'s name and description beside the circles.',
    schema: object({
      type: {const: 'concentric'},
      rings: list(object({label: text('The ring.', 24), description: text('What it holds (with labels: side).', 60), tone: TEXT_TONE}, ['label']), 6, 2),
      order: {...oneOf('outer-first', 'inner-first'), description: 'Which ring the list starts with (default outer-first).'},
      labels: {...oneOf('inside', 'side'), description: 'inside (default): names in the rings. side: names and descriptions beside them.'},
      centre: text('The word in the middle.', 16),
    }, ['type', 'rings']),
    example: {type: 'concentric', order: 'inner-first', labels: 'side', centre: '利用者', rings: [{label: 'チーム'}, {label: '顧客と取引先'}, {label: '社会'}]},
    check(part, at, issues) {
      if (part['labels'] !== 'side') items(part, 'rings').forEach((r, i) => { if (r['description'] !== undefined) issues.push({path: `${at}.rings[${i}].description`, message: "is drawn only with labels: 'side'"}); });
    },
    build(part) {
      const {rings, ...opts} = withoutType(part);
      return concentric(rings as never, opts as never);
    },
  },
  {
    type: 'harvey',
    description: 'Harvey balls: a table of options (columns) rated on criteria (rows) with circles filled from 0 (empty) to 4 (full), such as a comparison of products or vendors. A legend names the five levels.',
    schema: object({
      type: {const: 'harvey'},
      rows: list(text('A criterion.', 30), 15, 1),
      cols: list(text('An option.', 20), 8, 1),
      values: list({type: 'array', items: {type: 'integer', minimum: 0, maximum: 4, description: '0 (empty) to 4 (full).'}, minItems: 1, maxItems: 8, description: 'One per column.'}, 15, 1),
      corner: text('The top-left heading.', 20),
      levels: {type: 'array', items: text('A level.', 10), minItems: 5, maxItems: 5, description: 'The names of 0 to 4 in the legend (default なし, 一部, 半分, ほぼ, 十分).'},
      highlight: list(text('A column name.', 20), 3),
    }, ['type', 'rows', 'cols', 'values']),
    example: {type: 'harvey', corner: '評価項目', rows: ['価格', '機能', 'サポート'], cols: ['A 社', 'B 社', 'C 社'], values: [[4, 2, 3], [2, 4, 3], [1, 3, 4]]},
    en: {levels: ['None', 'Some', 'Half', 'Most', 'Full']},
    check(part, at, issues) {
      const rows = part['rows'] as unknown[], cols = part['cols'] as unknown[], values = part['values'] as unknown[];
      uniqueTexts(rows, `${at}.rows`, 'row', issues);
      uniqueTexts(cols, `${at}.cols`, 'column', issues);
      if (values.length !== rows.length) issues.push({path: `${at}.values`, message: `has ${values.length} rows; there are ${rows.length} rows`});
      values.forEach((r, i) => lengthIs(r, cols.length, `${at}.values[${i}]`, 'columns', issues));
      items(part, 'highlight').forEach((h, i) => { if (!cols.includes(h)) issues.push({path: `${at}.highlight[${i}]`, message: `${JSON.stringify(h)} is not a column (known: ${cols.join(', ')})`}); });
    },
    build(part) {
      const {rows, cols, values, ...opts} = withoutType(part);
      return harvey(rows as never, cols as never, values as never, opts as never);
    },
  },
  {
    type: 'compare',
    description: 'A comparison table (比較表): options (columns) rated on criteria (rows), each cell a mark (◎ best, ○ good, △ fair, × poor) and the reason for it, set side by side so the marks read down a column and every rating says why. A cell that is not rated has the mark - (a dash). Use it to compare plans, products or vendors with reasons; for marks alone use matrix, for filled circles harvey.',
    schema: object({
      type: {const: 'compare'},
      rows: list(text('A criterion.', 30), 12, 1),
      cols: list(text('An option.', 20), 6, 1),
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
      return compare(rows as never, cols as never, tuples as never, opts as never);
    },
  },
  {
    type: 'burndown',
    description: 'A burndown chart: the work left at the end of each day of a sprint, against the ideal straight line from the total to 0. Days count from 0 (the start); give actual values only for the days reached so far.',
    schema: object({
      type: {const: 'burndown'},
      total: {...AMOUNT, description: 'The work at the start (points, hours, tickets).'},
      days: count('The length of the period in days.', MAX_DAYS),
      actual: {...list(AMOUNT, MAX_DAYS + 1, 1), description: 'The work left at the end of day 0, 1, 2 ... (only the days reached).'},
      names: object({ideal: text('The ideal line.', 16), actual: text('The actual line.', 16)}, [], 'The names of the two lines (default 理想, 実績).'),
      xLabel: text('The x axis (default 日).', 16),
      yLabel: text('The y axis (default 残り).', 16),
    }, ['type', 'total', 'days', 'actual']),
    example: {type: 'burndown', total: 40, days: 10, actual: [40, 38, 35, 35, 30, 26, 22]},
    en: {names: {ideal: 'Ideal', actual: 'Actual'}, xLabel: 'Day', yLabel: 'Remaining'},
    check(part, at, issues) {
      const days = part['days'] as number, n = (part['actual'] as unknown[]).length;
      if (n > days + 1) issues.push({path: `${at}.actual`, message: `has ${n} values; days 0 to ${days} have ${days + 1}`});
    },
    build(part) {
      const spec = {total: part['total'], days: part['days'], actual: part['actual']} as never, opts = axisLabels(part) as never, names = part['names'] as Json | undefined;
      return names ? lines(...renamed(burndownOpts(spec, opts) as never, [names['ideal'] as string, names['actual'] as string])) : burndown(spec, opts);
    },
  },
  {
    type: 'burnup',
    description: 'A burnup chart: the work done by the end of each day climbing towards the scope, which can be one number or grow day by day. Days count from 0 (the start); give done values only for the days reached so far.',
    schema: object({
      type: {const: 'burnup'},
      scope: {oneOf: [AMOUNT, list(AMOUNT, MAX_DAYS + 1, 2)], description: 'The total work: one number, or the scope at the end of each day from day 0 (it may grow).'},
      days: count('The length of the period in days.', MAX_DAYS),
      done: {...list(AMOUNT, MAX_DAYS + 1, 1), description: 'The work done by the end of day 0, 1, 2 ... (only the days reached).'},
      names: object({scope: text('The scope line.', 16), done: text('The done line.', 16)}, [], 'The names of the two lines (default スコープ, 完了).'),
      xLabel: text('The x axis (default 日).', 16),
      yLabel: text('The y axis (default 完了).', 16),
    }, ['type', 'scope', 'days', 'done']),
    example: {type: 'burnup', scope: [30, 30, 30, 34, 34, 36, 36], days: 10, done: [0, 4, 7, 11, 14, 18, 21]},
    en: {names: {scope: 'Scope', done: 'Done'}, xLabel: 'Day', yLabel: 'Done'},
    check(part, at, issues) {
      const days = part['days'] as number;
      for (const k of ['scope', 'done']) {
        const v = part[k];
        if (Array.isArray(v) && v.length > days + 1) issues.push({path: `${at}.${k}`, message: `has ${v.length} values; days 0 to ${days} have ${days + 1}`});
      }
    },
    build(part) {
      const spec = {scope: part['scope'], days: part['days'], done: part['done']} as never, opts = axisLabels(part) as never, names = part['names'] as Json | undefined;
      return names ? lines(...renamed(burnupOpts(spec, opts) as never, [names['scope'] as string, names['done'] as string])) : burnup(spec, opts);
    },
  },
  {
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
      return mekko(columns as never, {...(part['unit'] === undefined ? {} : {unit: part['unit'] as string}), ...(part['totalLabel'] === undefined ? {} : {totalLabel: part['totalLabel'] as string}), ...(part['brackets'] === undefined ? {} : {brackets: part['brackets'] as [string, string]})});
    },
    en: {totalLabel: 'Total', brackets: [' (', ')']},
  },
  {
    type: 'butterfly',
    description: 'A butterfly chart: two groups compared row by row, bars running left and right from a shared middle column of labels, such as men and women by age or us and a competitor by criterion.',
    schema: object({
      type: {const: 'butterfly'},
      leftLabel: text('The name of the left group.', 20),
      rightLabel: text('The name of the right group.', 20),
      rows: list(object({label: text('The row.', 20), left: AMOUNT, right: AMOUNT}, ['label', 'left', 'right']), 15, 1),
      unit: text('Written after every value.', 8),
      sort: {...oneOf('given', 'left', 'right'), description: 'The order of the rows: as given (default), or largest first by one side.'},
      leftTone: CHART_TONE,
      rightTone: CHART_TONE,
    }, ['type', 'leftLabel', 'rightLabel', 'rows']),
    example: {type: 'butterfly', leftLabel: '男性', rightLabel: '女性', unit: '人', rows: [{label: '20 代', left: 32, right: 41}, {label: '30 代', left: 45, right: 38}, {label: '40 代', left: 28, right: 30}]},
    check(part, at, issues) {
      uniqueTexts(part['rows'] as unknown[], `${at}.rows`, 'row', issues, 'label');
      if (items(part, 'rows').every(r => r['left'] === 0 && r['right'] === 0)) issues.push({path: `${at}.rows`, message: 'all values are 0'});
    },
    build(part) {
      const {rows, ...opts} = withoutType(part);
      return butterfly(rows as never, opts as never);
    },
  },
  {
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
      return combo(categories as never, series as never, opts as never);
    },
  },
];
