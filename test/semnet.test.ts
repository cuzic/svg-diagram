import test from 'node:test';
import assert from 'node:assert/strict';
import './helpers/strict-width.ts';
import {analyzeCausalLoops, analyzeCriticalPath, causalLoop, checkDiagram, closeMeasurer, dependencyNetwork, diagram, pert, renderDiagram} from '../lib/dsl.ts';

test.after(() => closeMeasurer());

test('PERT computes earliest/latest times, slack and critical path', () => {
  const a = analyzeCriticalPath([
    {id: 'a', label: 'A', duration: 3}, {id: 'b', label: 'B', duration: 5, predecessors: ['a']},
    {id: 'c', label: 'C', duration: 2, predecessors: ['a']}, {id: 'd', label: 'D', duration: 1, predecessors: ['b', 'c']},
  ]);
  assert.equal(a.duration, 9); assert.deepEqual(a.criticalPath, ['a', 'b', 'd']);
  assert.deepEqual(a.tasks.map(t => [t.id, t.es, t.ef, t.ls, t.lf, t.slack, t.critical]), [
    ['a', 0, 3, 0, 3, 0, true], ['b', 3, 8, 3, 8, 0, true], ['c', 3, 5, 6, 8, 3, false], ['d', 8, 9, 8, 9, 0, true],
  ]);
});

test('PERT retains tied parallel critical paths deterministically', () => {
  const a = analyzeCriticalPath([{id: 's', label: 'S', duration: 0}, {id: 'a', label: 'A', duration: 4, predecessors: ['s']}, {id: 'b', label: 'B', duration: 4, predecessors: ['s']}, {id: 'z', label: 'Z', duration: 1, predecessors: ['a', 'b']}]);
  assert.deepEqual(a.criticalPath, ['s', 'a', 'z']);
  assert.deepEqual(a.criticalEdges, [{from: 's', to: 'a'}, {from: 's', to: 'b'}, {from: 'a', to: 'z'}, {from: 'b', to: 'z'}]);
  assert.ok(a.tasks.every(t => t.critical));
});

test('PERT rejects unknown predecessors and cycles clearly', () => {
  assert.throws(() => analyzeCriticalPath([{id: 'a', label: 'A', duration: 1, predecessors: ['x']}]), /unknown predecessor "x"/);
  assert.throws(() => analyzeCriticalPath([{id: 'a', label: 'A', duration: 1, predecessors: ['b']}, {id: 'b', label: 'B', duration: 1, predecessors: ['a']}]), /cycle detected among tasks: a, b/);
});

test('causal loops classify reinforcing and balancing, including multiple loops', () => {
  const loops = analyzeCausalLoops(['a', 'b', 'c'], [
    {from: 'a', to: 'b', polarity: '+'}, {from: 'b', to: 'a', polarity: '+'},
    {from: 'b', to: 'c', polarity: '-'}, {from: 'c', to: 'a', polarity: '+'},
  ]);
  assert.deepEqual(loops.map(l => [l.nodes.join(''), l.negativeLinks, l.kind]), [['ab', 0, 'R'], ['abc', 1, 'B']]);
  assert.throws(() => analyzeCausalLoops(['a'], [{from: 'a', to: 'x', polarity: '+'}]), /unknown node/);
});

test('semantic networks render and verify clean in both directions', async () => {
  const bands = [
    pert([{id: 'a', label: '開始', duration: 1}, {id: 'b', label: '完了', duration: 2, predecessors: ['a']}], {height: 150}),
    causalLoop([{id: 'x', label: '需要'}, {id: 'y', label: '供給'}], [{from: 'x', to: 'y', polarity: '+'}, {from: 'y', to: 'x', polarity: '-', delay: true}], {height: 170}),
    dependencyNetwork([{id: 'ui', label: '画面', kind: 'app'}, {id: 'api', label: 'API', kind: 'service'}], [{from: 'ui', to: 'api', type: 'uses', weight: 3}], {direction: 'TB', height: 190}),
  ];
  for (const band of bands) {
    const checked = await checkDiagram(diagram({theme: 'blue'}).add(band));
    assert.deepEqual(checked.verdict.problems, []);
    const rendered = await renderDiagram(diagram({theme: 'blue', appearance: 'dark'}).add(band), {name: 'semnet-test.svg', budget: 'cacheOnly'});
    assert.match(rendered.svg, /<svg/); assert.match(rendered.svg, /marker|path|text/);
  }
});

test('dependency network rejects unknown nodes and invalid weights', () => {
  assert.throws(() => dependencyNetwork([{id: 'a', label: 'A'}], [{from: 'a', to: 'x', type: 'uses'}]), /unknown node/);
  assert.throws(() => dependencyNetwork([{id: 'a', label: 'A'}], [{from: 'a', to: 'a', type: 'uses', weight: -1}]), /must be >= 0/);
});

test('causal loops are numbered within their kind and the dependency legend matches the edge styles', async () => {
  const loops = causalLoop([{id: 'a', label: 'A'}, {id: 'b', label: 'B'}, {id: 'c', label: 'C'}], [
    {from: 'a', to: 'b', polarity: '+'}, {from: 'b', to: 'a', polarity: '+'}, {from: 'b', to: 'c', polarity: '-'}, {from: 'c', to: 'a', polarity: '+'},
  ]);
  assert.match(loops.alt!, /R1: a → b; B1: a → b → c/);
  const deps = dependencyNetwork([{id: 'a', label: 'A'}, {id: 'b', label: 'B'}], [{from: 'a', to: 'b', type: 'blocks'}], {height: 160});
  const {svg} = await renderDiagram(diagram({theme: 'blue'}).add(deps), {name: 'semnet-legend.svg', budget: 'cacheOnly'});
  assert.equal(svg.match(/stroke-dasharray="10,4,2,4"/g)?.length, 2); // the edge and its legend sample
});

test('a long dependency legend wraps into rows instead of running off the figure', async () => {
  const kinds = ['フロントエンドアプリ', 'バックエンドサービス', 'データベース基盤', '外部パートナーAPI', 'バッチ処理基盤', '監視基盤'];
  const band = dependencyNetwork(kinds.map((k, i) => ({id: `n${i}`, label: `N${i}`, kind: k})), ['depends', 'uses', 'blocks', 'relates', 'feeds'].map((type, i) => ({from: `n${i}`, to: `n${i + 1}`, type})),
    {edgeTypes: {depends: '依存関係あり', uses: '利用している', blocks: '阻害している', relates: '関連している', feeds: 'データ供給'}});
  const checked = await checkDiagram(diagram({theme: 'blue'}).add(band));
  assert.deepEqual(checked.verdict.problems, []);
});

test('causal interventions are validated, are anchors, and do not change loop classification', () => {
  const nodes = [{id: 'a', label: '需要'}, {id: 'b', label: '供給'}], links = [{from: 'a', to: 'b', polarity: '+' as const}, {from: 'b', to: 'a', polarity: '-' as const}];
  const iv = {id: 'fix', label: '標準の合意', to: 'a', polarity: '-' as const};
  const band = causalLoop(nodes, links, {interventions: [iv, {...iv, id: 'fix2', to: ['a', 'b'], polarity: 'opposite', delay: true}]});
  assert.deepEqual(band.ids, ['a', 'b', 'fix', 'fix2']);
  assert.deepEqual(Object.keys((band as unknown as {anchors: object}).anchors).sort(), ['a', 'b', 'fix', 'fix2']);
  assert.match(band.alt ?? '', /Interventions: 標準の合意 -> 需要 \(-\); 標準の合意 -> 需要, 供給 \(-, delayed\)/);
  assert.equal(causalLoop(nodes, links).alt, causalLoop(nodes, links, {interventions: []}).alt);
  assert.deepEqual((band as unknown as {spec: {loops: {kind: string}[]}}).spec.loops.map(l => l.kind), ['B']);
  const bad = (v: object, re: RegExp): void => assert.throws(() => causalLoop(nodes, links, {interventions: [{...iv, ...v} as never]}), re);
  bad({to: 'zzz'}, /to names unknown node "zzz"/);
  bad({to: []}, /at least one node/);
  bad({to: ['a', 'a']}, /twice/);
  bad({polarity: 'x'}, /invalid polarity/);
  bad({polarity: undefined}, /invalid polarity/);
  bad({delay: 'yes'}, /delay must be/);
  bad({label: ''}, /label/);
  bad({id: 'a'}, /must be unique/);
  assert.throws(() => causalLoop(nodes, links, {interventions: [iv, {...iv, id: 'g', to: 'fix'}]}), /cannot act on the intervention "fix"/);
  assert.throws(() => causalLoop(nodes, links, {id: 'fix', interventions: [iv]}), /fix/);
});
