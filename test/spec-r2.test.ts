// Spec parts of round R2 (lib/spec-parts/r2.ts): each draws the same SVG as the DSL call it stands for, and its mistakes are reported at
// their place.
import test from 'node:test';
import assert from 'node:assert/strict';
import {bubble, closeMeasurer, diagram, heatmap, renderDiagram, sankey, strategyCanvas, tornado, treemap} from '../lib/dsl.ts';
import {specToDiagram, validateSpec} from '../lib/spec.ts';
import type {Diagram} from '../lib/types/index.ts';

test.after(() => closeMeasurer());

const svgOf = async (d: Diagram) => (await renderDiagram(d, {name: 'x.svg', budget: 'cacheOnly'})).svg;
const spec = (...parts: unknown[]) => ({version: 1, title: '例', parts});
const pathsOf = (input: unknown) => validateSpec(input).map(i => i.path);
const same = async (part: Record<string, unknown>, dsl: unknown) =>
  assert.equal(await svgOf(specToDiagram(spec(part))), await svgOf(diagram({theme: 'blue', title: '例'}).add(dsl as never) as unknown as Diagram), String(part['type']));

const NODES = [{id: 'a', label: '広告'}, {id: 'v', label: '訪問'}, {id: 'b', label: '購入', tone: 'accent'}, {id: 'l', label: '離脱'}];
const LINKS = [{from: 'a', to: 'v', value: 100}, {from: 'v', to: 'b', value: 15}, {from: 'v', to: 'l', value: 85, tone: 'muted'}];

test('sankey, treemap and heatmap specs draw the same SVG as the DSL', async () => {
  await same({type: 'sankey', nodes: NODES, links: LINKS, unit: '人', linkLabels: false}, sankey(NODES as never, LINKS as never, {unit: '人', linkLabels: false}));
  const tree = [{label: '国内', children: [{label: '東京', value: 40}, {label: '大阪', value: 22}]}, {label: '海外', value: 30, tone: 'accent'}];
  await same({type: 'treemap', items: tree, unit: '億円', percent: true}, treemap(tree as never, {unit: '億円', percent: true}));
  const rows = ['A', 'B'], cols = ['1月', '2月', '3月'], values = [[1, 2, 3], [4, 5, 6]];
  await same({type: 'heatmap', rows, cols, values, unit: '%', corner: '店 ＼ 月', levels: 4}, heatmap(rows, cols, values, {unit: '%', corner: '店 ＼ 月', levels: 4}));
});

test('bubble, tornado and strategy canvas specs draw the same SVG as the DSL', async () => {
  const points = [{label: 'A', x: 1, y: 2, size: 10}, {label: 'B', x: 3, y: 1, size: 30, tone: 'accent'}];
  const axes = {x: {title: '成長率', unit: '%', line: 2}, y: {title: '利益率'}, sizeTitle: '売上', sizeUnit: '億円'};
  await same({type: 'bubble', points, ...axes}, bubble(points as never, axes));
  const items = [{label: '単価', low: 70, high: 130}, {label: '数量', low: 90, high: 110}];
  await same({type: 'tornado', base: 100, items, unit: '万円', sort: false}, tornado(items, {base: 100, unit: '万円', sort: false}));
  await same({type: 'tornado', base: 100, items}, tornado(items, {base: 100}));
  const factors = ['価格', '品揃え', '接客'], series = [{label: '自社', values: [1, 4, 5]}, {label: '他社', values: [3, 3, 3]}];
  await same({type: 'strategyCanvas', factors, series}, strategyCanvas(factors, series));
  await same({type: 'strategyCanvas', factors, series, max: 7, lowLabel: '少', highLabel: '多', yLabel: '水準'}, strategyCanvas(factors, series, {levels: {max: 7, low: '少', high: '多'}, y: {label: '水準'}}));
});

test('in English the default words of a tornado and a strategy canvas are English', async () => {
  const en = (part: unknown) => specToDiagram({version: 1, title: 'x', lang: 'en', parts: [part]});
  const t = await svgOf(en({type: 'tornado', base: 10, items: [{label: 'Price', low: 5, high: 15}]}));
  assert.match(t, /Low case/); assert.match(t, /High case/); assert.doesNotMatch(t, /ケース|基準/);
  const s = await svgOf(en({type: 'strategyCanvas', factors: ['Price', 'Range'], series: [{label: 'Us', values: [1, 4]}]}));
  assert.match(s, /Level offered/); assert.doesNotMatch(s, /高い|低い|提供価値/);
});

test('sankey links name nodes, flow one way, once, with a positive value; every node is linked', () => {
  assert.deepEqual(pathsOf(spec({type: 'sankey', nodes: NODES, links: [...LINKS, {from: 'v', to: 'x', value: 1}]})), ['parts[0].links[3].to']);
  assert.deepEqual(pathsOf(spec({type: 'sankey', nodes: NODES, links: [...LINKS, {from: 'l', to: 'a', value: 1}]})), ['parts[0].links']);
  assert.deepEqual(pathsOf(spec({type: 'sankey', nodes: NODES, links: [...LINKS, {from: 'b', to: 'b', value: 1}]})), ['parts[0].links[3].to', 'parts[0].links']);
  assert.deepEqual(pathsOf(spec({type: 'sankey', nodes: NODES, links: [...LINKS, {from: 'a', to: 'v', value: 3}]})), ['parts[0].links[3]']);
  assert.deepEqual(pathsOf(spec({type: 'sankey', nodes: NODES, links: [{...LINKS[0], value: 0}, ...LINKS.slice(1)]})), ['parts[0].links[0].value']);
  assert.deepEqual(pathsOf(spec({type: 'sankey', nodes: [...NODES, {id: 'z'}], links: LINKS})), ['parts[0].nodes[4]']);
});

test('treemap cells have a value or children, not both; heatmap values match rows and columns', () => {
  assert.deepEqual(pathsOf(spec({type: 'treemap', items: [{label: 'A'}, {label: 'B', value: 2, children: [{label: 'c', value: 0}]}]})), ['parts[0].items[0].value', 'parts[0].items[1].value', 'parts[0].items[1].children[0].value']);
  assert.deepEqual(pathsOf(spec({type: 'treemap', items: Array.from({length: 3}, (_, i) => ({label: `g${i}`, children: Array.from({length: 15}, (_, j) => ({label: `c${j}`, value: 1}))}))})), ['parts[0].items']);
  assert.deepEqual(pathsOf(spec({type: 'heatmap', rows: ['a', 'b'], cols: ['x', 'y'], values: [[1, 2], [3]]})), ['parts[0].values[1]']);
  assert.deepEqual(pathsOf(spec({type: 'heatmap', rows: ['a', 'b'], cols: ['x'], values: [[1]]})), ['parts[0].values']);
  assert.deepEqual(pathsOf(spec({type: 'heatmap', rows: ['a'], cols: ['x'], values: [[1]], min: 5, max: 5})), ['parts[0].max']);
});

test('bubble sizes are positive and labels unique; a line label needs its line; strategy levels stay in range and match the factors', () => {
  assert.deepEqual(pathsOf(spec({type: 'bubble', points: [{label: 'A', x: 1, y: 1, size: 0}, {label: 'A', x: 2, y: 2, size: 1}], x: {lineLabel: '基準'}})), ['parts[0].points[0].size', 'parts[0].points[1].label', 'parts[0].x.lineLabel']);
  assert.deepEqual(pathsOf(spec({type: 'bubble', points: [{label: 'A', x: 1, y: 1, size: 1}], y: {min: 0, max: 10, line: 12}})), ['parts[0].y.line']);
  assert.deepEqual(pathsOf(spec({type: 'strategyCanvas', factors: ['a', 'b'], series: [{label: 'S', values: [1, 2, 3]}, {label: 'T', values: [1, 9]}]})), ['parts[0].series[0].values', 'parts[0].series[1].values[1]']);
  assert.deepEqual(pathsOf(spec({type: 'strategyCanvas', factors: ['a', 'b'], series: [{label: 'S', values: [1, 2]}], min: 5, max: 5})), ['parts[0].max', 'parts[0].series[0].values[0]', 'parts[0].series[0].values[1]']);
});

test('the largest sankey and heatmap a spec allows still draw', async () => {
  const nodes = Array.from({length: 20}, (_, i) => ({id: `n${i}`, label: `段階${i}`}));
  const links = Array.from({length: 40}, (_, i) => ({from: `n${i % 10}`, to: `n${10 + ((i * 7) % 10)}`, value: 1 + i}))
    .filter((l, i, all) => all.findIndex(m => m.from === l.from && m.to === l.to) === i);
  assert.deepEqual(validateSpec(spec({type: 'sankey', nodes, links})), []);
  const t = performance.now();
  await svgOf(specToDiagram(spec({type: 'heatmap', rows: Array.from({length: 15}, (_, i) => `行${i}`), cols: Array.from({length: 12}, (_, i) => `${i + 1}月`), values: Array.from({length: 15}, (_, i) => Array.from({length: 12}, (_, j) => i * j))})));
  assert.ok(performance.now() - t < 5000);
});
