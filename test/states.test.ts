import test from 'node:test';
import assert from 'node:assert/strict';
import {box, checkDiagram, closeMeasurer, connect, diagram, renderDiagram, stateDiagram} from '../lib/dsl.ts';
import type {LaidOutStates} from '../lib/types.ts';

test.after(() => closeMeasurer());

const S = (id: string, extra: object = {}) => ({id, label: id, ...extra});
const flow = (opts: object = {}) => stateDiagram(
  [S('idle'), S('run'), S('paused'), S('done', {final: true}), S('failed', {tone: 'danger'})],
  [
    {from: 'idle', to: 'run', label: '開始'}, {from: 'run', to: 'paused', label: '停止'}, {from: 'paused', to: 'run', label: '再開'},
    {from: 'run', to: 'done', label: '完了'}, {from: 'run', to: 'failed', label: '失敗', line: 'dashed'}, {from: 'run', to: 'run', label: '再試行'},
    {from: 'idle', to: 'done', label: 'スキップ'},
  ],
  {initial: 'idle', ...opts},
);

const laid = async (...bands: unknown[]) => {
  const {laidOut, verdict} = await checkDiagram(diagram({theme: 'blue'}).add(...(bands as never[])));
  return {t: laidOut.laidOut.find(b => b.type === 'states') as LaidOutStates, verdict};
};

const overlap = (a: {x: number; y: number; w: number; h: number}, b: {x: number; y: number; w: number; h: number}): boolean => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

for (const dir of ['right', 'down'] as const) {
  test(`stateDiagram() dir ${dir}: states do not overlap, no arrow crosses an unrelated state, verify passes`, async () => {
    const {t, verdict} = await laid(flow({dir}));
    assert.deepEqual(verdict.problems, []);
    assert.equal(t.nodes.length, 5);
    assert.equal(t.edges.length, 8); // 7 transitions + the arrow from the initial dot
    for (let i = 0; i < t.nodes.length; i++) for (let j = i + 1; j < t.nodes.length; j++) assert.ok(!overlap(t.nodes[i], t.nodes[j]));
    assert.ok(t.initial);
    for (const e of t.edges) assert.ok(e.points.length >= 2);
    for (const l of t.labels) assert.ok(!t.nodes.some(n => overlap(l, n)), `label ${l.text} sits on a state`);
    const run = t.anchors.find(a => a.id === 'run')!, idle = t.anchors.find(a => a.id === 'idle')!;
    if (dir === 'right') assert.ok(run.x > idle.x + idle.w); else assert.ok(run.y > idle.y + idle.h);
  });
}

test('stateDiagram(): arrows end on the head state, the loop is above its state, the skipping arrow detours', async () => {
  const {t} = await laid(flow());
  const by = (id: string) => t.anchors.find(a => a.id === id)!;
  const edge = (from: string, to: string) => t.edges.find(e => e.from === from && e.to === to)!;
  const onEdge = (p: {x: number; y: number}, r: {x: number; y: number; w: number; h: number}): boolean => p.x >= r.x - 0.5 && p.x <= r.x + r.w + 0.5 && p.y >= r.y - 0.5 && p.y <= r.y + r.h + 0.5;
  for (const e of t.edges.filter(x => x.from !== 'run' || x.to !== 'run')) {
    const end = e.points[e.points.length - 1], head = by(e.to);
    assert.ok(e.from === '\u0000init' ? e.to === 'idle' : onEdge(end, head), `${e.from} -> ${e.to} ends on ${e.to}`);
  }
  const loop = edge('run', 'run');
  assert.ok(loop.points.every(p => p.y <= by('run').y + 0.5));
  assert.ok(edge('idle', 'done').points.length > 4, 'idle -> done goes round the states between');
  assert.equal(edge('run', 'failed').line, 'dashed');
});

test('stateDiagram() states are anchors for connect(); the SVG has the boxes, double outline for final, arrowheads', async () => {
  const sd = flow();
  assert.equal(sd.anchors.run.id, 'run');
  const {verdict} = await checkDiagram(diagram({theme: 'blue'}).add(sd, box({id: 'log', title: 'ログ'}), connect('run', 'log', {route: 'elbow'})));
  assert.deepEqual(verdict.problems, []);
  const {svg} = await renderDiagram(diagram({theme: 'blue'}).add(sd), {name: 's.svg', budget: 'cacheOnly'});
  assert.equal(svg.match(/<rect [^>]*rx="8"/g)?.length, 5);
  assert.equal(svg.match(/<rect [^>]*rx="5"/g)?.length, 1);
  assert.match(svg, /stroke-dasharray="6,4"/);
  assert.match(svg, />再試行</);
  assert.equal(svg.includes('marker-end'), false, 'arrowheads are shapes');
});

test('stateDiagram() rejects bad input', async () => {
  assert.throws(() => stateDiagram([], []), /at least one state/);
  assert.throws(() => stateDiagram([S('a')], [], {dir: 'up' as never}), /dir must be/);
  assert.throws(() => stateDiagram([S('a')], [{from: 'a', to: 'a', line: 'wavy' as never}]), /has line/);
  const bad = (states: object[], tr: object[], opts: object = {}) => checkDiagram(diagram({theme: 'blue'}).add(stateDiagram(states as never, tr as never, opts as never)));
  await assert.rejects(() => bad([S('a'), S('a')], []), /duplicate state id "a"/);
  await assert.rejects(() => bad([S('a')], [{from: 'a', to: 'zz'}]), /unknown state "zz"/);
  await assert.rejects(() => bad([S('a')], [], {initial: 'nope'}), /initial names unknown state "nope"/);
  await assert.rejects(() => bad([{id: 'a', label: ''}], []), /needs a label/);
});

test('stateDiagram() without labels or initial still lays out, and two opposite arrows between two states do not share a line', async () => {
  const {t, verdict} = await laid(stateDiagram([S('a'), S('b')], [{from: 'a', to: 'b'}, {from: 'b', to: 'a'}]));
  assert.deepEqual(verdict.problems, []);
  const [e1, e2] = t.edges;
  assert.notEqual(e1.points[0].y, e2.points[e2.points.length - 1].y, 'a -> b leaves a at a different height than b -> a arrives');
  assert.notDeepEqual(e1.points, [...e2.points].reverse());
  assert.equal(t.labels.length, 0);
});
