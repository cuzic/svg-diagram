// Spec parts of round R2 (see lib/spec.ts): each keeps its schema, example, checks and builder together.
// Charts for analysis: flows (sankey), shares (treemap), a grid of values (heatmap), three measures at once (bubble), sensitivity
// (tornado) and a strategy canvas.
import {bubble, heatmap, sankey, strategyCanvas, tornado, treemap} from '../dsl-pure.ts';
import {AMOUNT, CHART_TONE, NUM, id, items, list, mustExist, object, oneOf, text, uniqueIds, withoutType} from '../spec-kit.ts';
import type {Json, JsonSchema, PartDef, SpecIssue} from '../spec-kit.ts';

const unit = (description = "Written after every number ('万円', '%')."): JsonSchema => text(description, 10);
const isNum = (v: unknown): v is number => typeof v === 'number';
/** A value that must be above 0 (an area, a thickness): the schema allows 0, this reports it at its place. */
function positive(v: unknown, path: string, what: string, issues: SpecIssue[]): void {
  if (isNum(v) && !(v > 0)) issues.push({path, message: `${what} must be more than 0 (got ${v})`});
}
/** `min` below `max` when both are given. */
function minBelowMax(o: Json | undefined, at: string, issues: SpecIssue[]): void {
  if (o && isNum(o['min']) && isNum(o['max']) && !(o['min'] < o['max'])) issues.push({path: `${at}.max`, message: `must be more than min (${o['min']})`});
}

const MAX_SANKEY_NODES = 20, MAX_SANKEY_LINKS = 40;
const MAX_TREEMAP_LEAVES = 40;
const MAX_HEATMAP_ROWS = 15, MAX_HEATMAP_COLS = 12;

const treemapLeaf: JsonSchema = object({
  label: text('The name of the cell.', 30),
  value: {...AMOUNT, description: 'The area: more than 0.'},
  tone: {...oneOf('accent', 'danger'), description: 'A solid colour to make this cell stand out.'},
}, ['label', 'value']);
const treemapGroup: JsonSchema = object({
  label: text('The name of the cell, or of the group.', 30),
  value: {...AMOUNT, description: 'The area of a cell with no children: more than 0.'},
  tone: {...oneOf('accent', 'danger'), description: 'A solid colour to make this cell stand out (a cell with no children).'},
  children: list(treemapLeaf, 15, 1),
}, ['label']);

const bubbleAxis = (which: string): JsonSchema => object({
  title: text('The name of the axis.', 30),
  unit: unit('Written after the numbers of the axis.'),
  min: NUM, max: NUM,
  line: {...NUM, description: 'A dashed reference line at this value (a threshold).'},
  lineLabel: text('The name of the reference line.', 20),
}, [], `The ${which} axis.`);

export const PARTS_R2: readonly PartDef[] = [
  {
    type: 'sankey',
    anchors: 'nodes',
    description: 'A Sankey diagram: flows between stages, such as visitors to purchases or a budget to its uses. The height of a node and the thickness of a ribbon follow the value. Flows go one way: no cycles.',
    schema: object({
      type: {const: 'sankey'},
      nodes: list(object({id: id('Referred to by links.'), label: text('The name of the node.', 30), tone: CHART_TONE}, ['id']), MAX_SANKEY_NODES, 2),
      links: list(object({
        from: id('A node id.'), to: id('A node id.'),
        value: {...AMOUNT, description: 'The amount that flows: more than 0.'},
        tone: {...oneOf('accent', 'danger', 'muted'), description: 'danger: a flow to watch (dashed outline too).'},
      }, ['from', 'to', 'value']), MAX_SANKEY_LINKS, 1),
      unit: unit(),
      align: {...oneOf('justify', 'left'), description: 'justify (default): the end nodes all on the right. left: each where its path ends.'},
      linkLabels: {type: 'boolean', description: 'false: no values on the ribbons.'},
    }, ['type', 'nodes', 'links']),
    example: {type: 'sankey', unit: '千人', nodes: [{id: 'ad', label: '広告'}, {id: 'seo', label: '検索'}, {id: 'visit', label: '訪問'}, {id: 'buy', label: '購入', tone: 'accent'}, {id: 'leave', label: '離脱', tone: 'muted'}], links: [{from: 'ad', to: 'visit', value: 60}, {from: 'seo', to: 'visit', value: 40}, {from: 'visit', to: 'buy', value: 15}, {from: 'visit', to: 'leave', value: 85, tone: 'muted'}]},
    check(part, at, issues) {
      const nodes = uniqueIds(part, 'nodes', at, issues);
      const seen = new Set<string>();
      const next = new Map<string, string[]>();
      items(part, 'links').forEach((l, i) => {
        mustExist(l['from'], nodes, `${at}.links[${i}].from`, 'node id', issues);
        mustExist(l['to'], nodes, `${at}.links[${i}].to`, 'node id', issues);
        positive(l['value'], `${at}.links[${i}].value`, 'a flow', issues);
        if (l['from'] === l['to']) issues.push({path: `${at}.links[${i}].to`, message: 'is the same node as from: a flow goes from one node to another'});
        const key = `${String(l['from'])}\u0000${String(l['to'])}`;
        if (seen.has(key)) issues.push({path: `${at}.links[${i}]`, message: `repeats the flow from "${String(l['from'])}" to "${String(l['to'])}": add the two values`});
        seen.add(key);
        if (typeof l['from'] === 'string' && typeof l['to'] === 'string') next.set(l['from'], [...(next.get(l['from']) ?? []), l['to']]);
      });
      // a cycle has no left-to-right order
      const state = new Map<string, 1 | 2>();
      const visit = (n: string): boolean => {
        if (state.get(n) === 2) return false;
        if (state.get(n) === 1) return true;
        state.set(n, 1);
        const cyc = (next.get(n) ?? []).some(visit);
        state.set(n, 2);
        return cyc;
      };
      if ([...next.keys()].some(visit)) issues.push({path: `${at}.links`, message: 'make a cycle: a Sankey diagram flows one way, so drop or reverse the link that leads back'});
      const used = new Set(items(part, 'links').flatMap(l => [l['from'], l['to']]));
      items(part, 'nodes').forEach((n, i) => { if (typeof n['id'] === 'string' && !used.has(n['id'])) issues.push({path: `${at}.nodes[${i}]`, message: `"${n['id']}" has no link: remove it or link it`}); });
    },
    build(part) {
      const {nodes, links, ...opts} = withoutType(part);
      return sankey(nodes as never, links as never, opts as never);
    },
  },
  {
    type: 'treemap',
    description: 'A treemap: shares of a whole as rectangles whose areas follow the values, such as sales by region and product. A cell with children is a group (its value is their sum); a cell too small for its name is drawn without it.',
    schema: object({
      type: {const: 'treemap'},
      items: list(treemapGroup, 15, 1),
      unit: unit(),
      percent: {type: 'boolean', description: "true: add each cell's share of the whole to its value."},
    }, ['type', 'items']),
    example: {type: 'treemap', unit: '億円', items: [{label: '国内', children: [{label: '東京', value: 40}, {label: '大阪', value: 22}, {label: '名古屋', value: 12}]}, {label: '海外', children: [{label: '北米', value: 30, tone: 'accent'}, {label: '欧州', value: 16}]}]},
    check(part, at, issues) {
      let leaves = 0;
      items(part, 'items').forEach((g, i) => {
        const p = `${at}.items[${i}]`, kids = items(g, 'children');
        if (kids.length) {
          if (g['value'] !== undefined) issues.push({path: `${p}.value`, message: 'a group takes the sum of its children: leave out its value'});
          if (g['tone'] !== undefined) issues.push({path: `${p}.tone`, message: 'only a cell with no children takes a tone'});
          kids.forEach((c, j) => positive(c['value'], `${p}.children[${j}].value`, 'an area', issues));
          leaves += kids.length;
        } else {
          if (g['value'] === undefined) issues.push({path: `${p}.value`, message: 'is required for a cell with no children'});
          else positive(g['value'], `${p}.value`, 'an area', issues);
          leaves += 1;
        }
      });
      if (leaves > MAX_TREEMAP_LEAVES) issues.push({path: `${at}.items`, message: `hold ${leaves} cells; the limit is ${MAX_TREEMAP_LEAVES}`});
    },
    build(part) {
      const {items: tree, ...opts} = withoutType(part);
      return treemap(tree as never, opts as never);
    },
  },
  {
    type: 'heatmap',
    description: 'A heatmap: a table of numbers shaded by size, such as sales by month and store or a cohort retention. Every cell has a number; the darker, the larger.',
    schema: object({
      type: {const: 'heatmap'},
      rows: list(text('A row name.', 20), MAX_HEATMAP_ROWS, 1),
      cols: list(text('A column name.', 12), MAX_HEATMAP_COLS, 1),
      values: list({type: 'array', items: NUM, minItems: 1, maxItems: MAX_HEATMAP_COLS, description: 'One number per column.'}, MAX_HEATMAP_ROWS, 1),
      unit: unit(),
      decimals: {type: 'integer', minimum: 0, maximum: 2, description: 'Decimals to print (default: as the data has, at most 2).'},
      min: {...NUM, description: 'The value of the lightest shade (default: the smallest).'},
      max: {...NUM, description: 'The value of the darkest shade (default: the largest).'},
      levels: {type: 'integer', minimum: 3, maximum: 6, description: 'How many shades (default 5).'},
      corner: text("The top-left heading, naming the rows and the columns ('店舗 ＼ 月').", 20),
      scale: {type: 'boolean', description: 'false: no legend of the shades.'},
    }, ['type', 'rows', 'cols', 'values']),
    example: {type: 'heatmap', unit: '%', corner: '登録月 ＼ 経過月', rows: ['4月', '5月', '6月'], cols: ['1か月', '2か月', '3か月'], values: [[62, 48, 40], [58, 45, 37], [66, 52, 44]]},
    check(part, at, issues) {
      const rows = items(part, 'rows').length, cols = items(part, 'cols').length, values = part['values'] as unknown[][];
      if (values.length !== rows) issues.push({path: `${at}.values`, message: `has ${values.length} rows; there are ${rows} rows`});
      values.forEach((r, i) => { if (r.length !== cols) issues.push({path: `${at}.values[${i}]`, message: `has ${r.length} numbers; there are ${cols} columns`}); });
      minBelowMax(part, at, issues);
    },
    build(part) {
      const {rows, cols, values, ...opts} = withoutType(part);
      return heatmap(rows as never, cols as never, values as never, opts as never);
    },
    en: {legendTitle: 'Legend', rangeMark: '–'},
  },
  {
    type: 'bubble',
    description: 'A bubble chart: items placed by two measures (x, y) with a circle whose area is a third, such as products by growth, share and sales. Axes can have a dashed threshold line.',
    schema: object({
      type: {const: 'bubble'},
      points: list(object({
        label: text('The name of the item.', 20),
        x: NUM, y: NUM,
        size: {...AMOUNT, description: 'The measure the area stands for: more than 0.'},
        tone: CHART_TONE,
      }, ['label', 'x', 'y', 'size']), 20, 1),
      x: bubbleAxis('horizontal'),
      y: bubbleAxis('vertical'),
      sizeTitle: text("What the area stands for ('売上').", 20),
      sizeUnit: unit('The unit of the area measure.'),
    }, ['type', 'points']),
    example: {type: 'bubble', x: {title: '市場成長率', unit: '%'}, y: {title: '利益率', unit: '%'}, sizeTitle: '売上', sizeUnit: '億円', points: [{label: '製品A', x: 12, y: 18, size: 40, tone: 'accent'}, {label: '製品B', x: 4, y: 25, size: 90}, {label: '製品C', x: 8, y: 6, size: 20}]},
    check(part, at, issues) {
      items(part, 'points').forEach((p, i) => positive(p['size'], `${at}.points[${i}].size`, 'a size', issues));
      const seen = new Set<string>();
      items(part, 'points').forEach((p, i) => { const l = p['label'] as string; if (seen.has(l)) issues.push({path: `${at}.points[${i}].label`, message: `"${l}" is used twice: name every item differently`}); seen.add(l); });
      for (const k of ['x', 'y']) {
        const a = part[k] as Json | undefined;
        minBelowMax(a, `${at}.${k}`, issues);
        if (a && a['lineLabel'] !== undefined && a['line'] === undefined) issues.push({path: `${at}.${k}.lineLabel`, message: 'names a line: give line too'});
        if (a && isNum(a['line'])) {
          const vs = items(part, 'points').map(p => p[k] as number);
          const lo = isNum(a['min']) ? a['min'] : Math.min(...vs), hi = isNum(a['max']) ? a['max'] : Math.max(...vs);
          if (isNum(a['min']) && a['line'] < lo || isNum(a['max']) && a['line'] > hi) issues.push({path: `${at}.${k}.line`, message: `is outside the axis (${lo} to ${hi})`});
        }
      }
    },
    build(part) {
      const {points, ...opts} = withoutType(part);
      return bubble(points as never, opts as never);
    },
    en: {areaLabel: 'Bubble area', circleLabel: 'one circle', brackets: [' (', ')']},
  },
  {
    type: 'tornado',
    description: 'A tornado chart: how much a result moves when each input goes from its low to its high value, longest bar first, such as the sensitivity of a profit forecast. `base` is the result of the base case.',
    schema: object({
      type: {const: 'tornado'},
      base: {...NUM, description: 'The result of the base case: the line the bars start from.'},
      items: list(object({
        label: text('The input that varies, with its range if useful.', 30),
        low: {...NUM, description: 'The result when this input is at its low value.'},
        high: {...NUM, description: 'The result when this input is at its high value.'},
      }, ['label', 'low', 'high']), 12, 1),
      unit: unit(),
      lowLabel: text('The name of the low case (default 低ケース).', 20),
      highLabel: text('The name of the high case (default 高ケース).', 20),
      baseLabel: text('The name of the base line (default 基準).', 20),
      sort: {type: 'boolean', description: 'false: keep the order given instead of the longest first.'},
    }, ['type', 'base', 'items']),
    example: {type: 'tornado', base: 100, unit: '百万円', items: [{label: '販売単価 ±10%', low: 70, high: 130}, {label: '販売数量 ±10%', low: 82, high: 118}, {label: '原材料費 ±10%', low: 112, high: 88}]},
    check(part, at, issues) {
      items(part, 'items').forEach((it, i) => { if (it['low'] === it['high'] && it['low'] === part['base']) issues.push({path: `${at}.items[${i}]`, message: 'moves the result neither way: leave it out'}); });
    },
    build(part) {
      const {items: rows, sort, ...opts} = withoutType(part);
      return tornado(rows as never, {...opts, ...(sort === false ? {sort: false} : {})} as never);
    },
    en: {lowLabel: 'Low case', highLabel: 'High case', baseLabel: 'Base'},
  },
  {
    type: 'strategyCanvas',
    description: "A strategy canvas (Blue Ocean): the factors of competition along the bottom and the level each company offers on each, one line per company. Levels run from min to max (default 0 to 5).",
    schema: object({
      type: {const: 'strategyCanvas'},
      factors: list(text('A factor of competition.', 14), 10, 2),
      series: list(object({label: text('The company or the offer.', 20), values: list(NUM, 10, 2)}, ['label', 'values']), 5, 1),
      min: {type: 'integer', minimum: 0, maximum: 9, description: 'The lowest level (default 0).'},
      max: {type: 'integer', minimum: 1, maximum: 10, description: 'The highest level (default 5).'},
      lowLabel: text('The word at the lowest level (default 低い).', 10),
      highLabel: text('The word at the highest level (default 高い).', 10),
      yLabel: text('The name of the vertical axis (default 提供価値の水準).', 20),
    }, ['type', 'factors', 'series']),
    example: {type: 'strategyCanvas', factors: ['価格', '品揃え', '接客', '待ち時間', '居心地'], series: [{label: '従来の理容店', values: [4, 3, 4, 4, 3]}, {label: 'QBハウス型', values: [1, 1, 1, 1, 1]}]},
    check(part, at, issues) {
      const n = items(part, 'factors').length;
      const lo = isNum(part['min']) ? part['min'] : 0, hi = isNum(part['max']) ? part['max'] : 5;
      if (!(lo < hi)) issues.push({path: `${at}.max`, message: `must be more than min (${lo})`});
      items(part, 'series').forEach((s, i) => {
        const vs = s['values'] as number[];
        if (vs.length !== n) issues.push({path: `${at}.series[${i}].values`, message: `has ${vs.length} levels; there are ${n} factors`});
        vs.forEach((v, j) => { if (v < lo || v > hi) issues.push({path: `${at}.series[${i}].values[${j}]`, message: `is ${v}, outside the levels ${lo} to ${hi}`}); });
      });
    },
    build(part) {
      const {factors, series, min, max, lowLabel, highLabel, yLabel} = withoutType(part);
      const levels = {...(min === undefined ? {} : {min}), ...(max === undefined ? {} : {max}), ...(lowLabel === undefined ? {} : {low: lowLabel}), ...(highLabel === undefined ? {} : {high: highLabel})};
      return strategyCanvas(factors as never, series as never, {levels, ...(yLabel === undefined ? {} : {y: {label: yLabel}})} as never);
    },
    en: {lowLabel: 'Low', highLabel: 'High', yLabel: 'Level offered'},
  },
];
