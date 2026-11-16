// Spec parts of round R5 (lib/spec-parts/r5.ts): each draws what the DSL draws, and each mistake is reported at its place.
import test from 'node:test';
import assert from 'node:assert/strict';
import {box, burndown, burnup, butterfly, closeMeasurer, combo, concentric, diagram, harvey, mekko, renderDiagram, steps, versus} from '../lib/dsl.ts';
import {specToDiagram, validateSpec} from '../lib/spec.ts';
import type {Diagram} from '../lib/types/index.ts';

test.after(() => closeMeasurer());

const svgOf = async (d: Diagram) => (await renderDiagram(d, {name: 'x.svg', budget: 'cacheOnly'})).svg;
const spec = (...parts: unknown[]) => ({version: 1, title: '例', parts});
const pathsOf = (input: unknown) => validateSpec(input).map(i => i.path);
const same = async (part: object, band: unknown) => {
  const dsl = diagram({theme: 'blue', title: '例'}).add(band as never);
  assert.equal(await svgOf(specToDiagram(spec(part))), await svgOf(dsl as unknown as Diagram));
};

test('steps, versus and concentric specs draw the same SVG as the DSL', async () => {
  const items = [{title: '申請', body: '書類'}, {title: '審査'}, {title: '承認', tag: '当日'}];
  await same({type: 'steps', items, numbered: true, highlight: 2, loopBack: [{from: 3, to: 1, label: '差し戻し'}]},
    steps(items as never, {numbered: true, highlight: 2, loopBack: [{from: 3, to: 1, label: '差し戻し'}]}));
  await same({type: 'versus', left: {title: '前', tone: 'muted', items: [{title: '紙'}]}, right: {title: '後', items: [{title: '電子', body: '速い'}]}},
    versus({id: 'vs0-left', title: '前', tone: 'muted', children: [box({title: '紙'})]}, {id: 'vs0-right', title: '後', children: [box({title: '電子', body: '速い'})]}));
  await same({type: 'versus', left: {title: '前', items: [{title: '紙'}]}, right: {title: '後', items: [{title: '電子'}]}, shared: {title: '共通', items: [{title: '目的'}], leftLabel: '照合'}},
    versus({id: 'vs0-left', title: '前', children: [box({title: '紙'})]}, {id: 'vs0-right', title: '後', children: [box({title: '電子'})]}, {shared: {id: 'vs0-shared', title: '共通', children: [box({title: '目的'})]}, connectLabels: {left: '照合'}}));
  const rings = [{label: 'チーム', description: '毎日'}, {label: '顧客'}, {label: '社会'}];
  await same({type: 'concentric', rings, order: 'inner-first', labels: 'side', centre: '利用者'}, concentric(rings, {order: 'inner-first', labels: 'side', centre: '利用者'}));
});

test('harvey, mekko, butterfly and combo specs draw the same SVG as the DSL', async () => {
  await same({type: 'harvey', rows: ['価格', '機能'], cols: ['A', 'B'], values: [[4, 1], [2, 3]], corner: '項目', highlight: ['B']},
    harvey(['価格', '機能'], ['A', 'B'], [[4, 1], [2, 3]], {corner: '項目', highlight: ['B']}));
  await same({type: 'mekko', unit: '億円', series: ['A', 'B'], columns: [{label: '法人', values: [40, 10]}, {label: '個人', values: [5, 20]}]},
    mekko([{label: '法人', parts: [{label: 'A', value: 40}, {label: 'B', value: 10}]}, {label: '個人', parts: [{label: 'A', value: 5}, {label: 'B', value: 20}]}], {unit: '億円'}));
  const rows = [{label: '20 代', left: 3, right: 4}, {label: '30 代', left: 5, right: 2}];
  await same({type: 'butterfly', leftLabel: '男性', rightLabel: '女性', rows, unit: '人', sort: 'left'}, butterfly(rows, {leftLabel: '男性', rightLabel: '女性', unit: '人', sort: 'left'}));
  const series = [{label: '売上', type: 'bar', values: [1, 2, 3]}, {label: '率', type: 'line', values: [5, 6, 4]}] as const;
  await same({type: 'combo', categories: ['a', 'b', 'c'], series, y: {unit: '億円'}, y2: {unit: '%', min: 0}}, combo(['a', 'b', 'c'], series, {y: {unit: '億円'}, y2: {unit: '%', min: 0}}));
});

test('burndown and burnup specs draw the same SVG as the DSL, and English names the lines', async () => {
  await same({type: 'burndown', total: 20, days: 5, actual: [20, 18, 11]}, burndown({total: 20, days: 5, actual: [20, 18, 11]}));
  await same({type: 'burnup', scope: 30, days: 5, done: [0, 6], yLabel: '点'}, burnup({scope: 30, days: 5, done: [0, 6]}, {y: {label: '点'}}));
  await same({type: 'burnup', scope: [30, 30, 34], days: 5, done: [0, 6, 9]}, burnup({scope: [30, 30, 34], days: 5, done: [0, 6, 9]}));
  for (const part of [{type: 'burndown', total: 20, days: 5, actual: [20, 18]}, {type: 'burnup', scope: 30, days: 5, done: [0, 6]}]) {
    const {svg} = await renderDiagram(specToDiagram({...spec(part), lang: 'en'}), {name: 'x.svg', budget: 'cacheOnly'});
    assert.doesNotMatch(svg, /理想|実績|スコープ|完了|>日<|残り/, part.type);
  }
  const {svg} = await renderDiagram(specToDiagram(spec({type: 'burndown', total: 20, days: 5, actual: [20], names: {ideal: '計画'}})), {name: 'x.svg', budget: 'cacheOnly'});
  assert.match(svg, /計画/);
  assert.match(svg, /実績/);
});

test('harvey levels follow the language of the spec', async () => {
  const part = {type: 'harvey', rows: ['a'], cols: ['A'], values: [[2]]};
  const en = await svgOf(specToDiagram({...spec(part), lang: 'en'}));
  assert.match(en, /Half/);
  assert.doesNotMatch(en, /半分/);
});

test('R5 mistakes are reported at their place', () => {
  const s = (part: object) => pathsOf(spec(part));
  const step3 = [{title: 'a'}, {title: 'b'}, {title: 'c'}];
  assert.deepEqual(s({type: 'steps', items: step3, highlight: 4}), ['parts[0].highlight']);
  assert.deepEqual(s({type: 'steps', items: step3, loopBack: [{from: 1, to: 2}]}), ['parts[0].loopBack[0]']);
  assert.deepEqual(s({type: 'steps', items: step3, loopBack: [{from: 5, to: 1}]}), ['parts[0].loopBack[0].from']);
  assert.deepEqual(s({type: 'versus', left: {title: 'a', items: []}, right: {title: 'b', items: [{title: 'x'}]}}), ['parts[0].left.items']);
  assert.deepEqual(s({type: 'concentric', rings: [{label: 'a', description: 'd'}, {label: 'b'}]}), ['parts[0].rings[0].description']);
  const hv = {type: 'harvey', rows: ['a', 'b'], cols: ['A', 'B']};
  assert.deepEqual(s({...hv, values: [[1, 2]]}), ['parts[0].values']);
  assert.deepEqual(s({...hv, values: [[1, 2], [3]]}), ['parts[0].values[1]']);
  assert.deepEqual(s({...hv, values: [[1, 2], [3, 5]]}), ['parts[0].values[1][1]']);
  assert.deepEqual(s({...hv, rows: ['a', 'a'], values: [[1, 2], [3, 4]], highlight: ['C']}), ['parts[0].rows[1]', 'parts[0].highlight[0]']);
  assert.deepEqual(s({type: 'burndown', total: 10, days: 2, actual: [10, 8, 5, 1]}), ['parts[0].actual']);
  assert.deepEqual(s({type: 'burndown', total: -1, days: 2, actual: [1]}), ['parts[0].total']);
  assert.deepEqual(s({type: 'burnup', scope: [10, 10, 12, 12], days: 2, done: [0]}), ['parts[0].scope']);
  assert.deepEqual(s({type: 'burnup', scope: 'x', days: 2, done: [0]}), ['parts[0].scope']);
  assert.deepEqual(s({type: 'mekko', series: ['A', 'B'], columns: [{label: 'x', values: [1, 2, 3]}, {label: 'y', values: [0, 0]}]}), ['parts[0].columns[0].values', 'parts[0].columns[1].values']);
  assert.deepEqual(s({type: 'butterfly', leftLabel: 'L', rightLabel: 'R', rows: [{label: 'a', left: 0, right: 0}, {label: 'a', left: 0, right: 0}]}), ['parts[0].rows[1].label', 'parts[0].rows']);
  const cb = (series: object[], extra: object = {}) => s({type: 'combo', categories: ['a', 'b'], series, ...extra});
  assert.deepEqual(cb([{label: 'x', type: 'bar', values: [1]}]), ['parts[0].series[0].values']);
  assert.deepEqual(cb([{label: 'x', type: 'bar', values: [1, 2], axis: 'right'}]), ['parts[0].series[0].axis']);
  assert.deepEqual(cb([{label: 'x', type: 'bar', values: [1, -2]}], {stack: true}), ['parts[0].series[0].values']);
  assert.deepEqual(cb([1, 2, 3, 4].map(i => ({label: `s${i}`, type: 'line', values: [1, 2]}))), ['parts[0].series']);
  assert.deepEqual(cb([{label: 'x', type: 'line', values: [1, 2]}], {y2: {min: 5, max: 5}}), ['parts[0].y2.max']);
});
