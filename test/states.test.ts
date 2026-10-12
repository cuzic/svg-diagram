import test from 'node:test';
import './helpers/strict-width.ts'; // a label the layout did not register for measuring throws instead of measuring 0 wide
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

// ---- review fixes ----
const rectHit = (a: {x: number; y: number; w: number; h: number}, b: {x: number; y: number; w: number; h: number}): boolean => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

test('stateDiagram(): a label chip is drawn in the figure\'s own note size (slide canvas), and counts for the smallest text', async () => {
  const {laidOut} = await checkDiagram(diagram({canvas: 'slide', theme: 'blue'}).add(stateDiagram([S('a'), S('b')], [{from: 'a', to: 'b', label: '開始する'}])));
  const t = laidOut.laidOut.find(b => b.type === 'states') as LaidOutStates;
  const note = laidOut.roles.note;
  assert.ok(note > 14);
  assert.equal(t.labels[0].size, note);
  assert.equal(t.labels[0].h, note + 8);
  const {svg} = await renderDiagram(diagram({canvas: 'slide', theme: 'blue'}).add(stateDiagram([S('a'), S('b')], [{from: 'a', to: 'b', label: '開始する'}])), {name: 's.svg', budget: 'cacheOnly'});
  assert.match(svg, new RegExp(`font-size="${note}"[^>]*>開始する<`));
});

test('stateDiagram(): five arrows out of one state: no chip sits on another arrow, each chip is on its own', async () => {
  const names = ['b', 'c', 'd', 'e', 'f'];
  const {t, verdict} = await laid(stateDiagram([S('a'), ...names.map(n => S(n))], names.map(n => ({from: 'a', to: n, label: `ev${n}`}))));
  assert.deepEqual(verdict.problems, []);
  for (const l of t.labels) t.edges.forEach((e, k) => {
    if (k === l.edge) return;
    for (let m = 0; m + 1 < e.points.length; m++) {
      const p = e.points[m], q = e.points[m + 1];
      assert.ok(!rectHit(l, {x: Math.min(p.x, q.x) - 1, y: Math.min(p.y, q.y) - 1, w: Math.abs(p.x - q.x) + 2, h: Math.abs(p.y - q.y) + 2}), `${l.text} sits on arrow ${e.from} -> ${e.to}`);
    }
  });
});

test('stateDiagram() dir down: a loop on the rightmost state, with a long label, fits the figure', async () => {
  const {t, verdict} = await laid(stateDiagram([S('a'), S('b'), S('c'), S('d')], [{from: 'a', to: 'b'}, {from: 'a', to: 'c'}, {from: 'a', to: 'd'}, {from: 'd', to: 'd', label: 'リトライする'}], {dir: 'down'}));
  assert.deepEqual(verdict.problems, []);
  assert.ok(t.labels[0].x + t.labels[0].w <= t.x + t.w);
});

test('stateDiagram() dir right: a loop does not touch the state above it', async () => {
  const {t} = await laid(stateDiagram([S('a'), S('b'), S('c'), S('c2')], [{from: 'a', to: 'b'}, {from: 'a', to: 'c'}, {from: 'a', to: 'c2'}, {from: 'c', to: 'c', label: 'x'}]));
  const loop = t.edges.find(e => e.from === 'c' && e.to === 'c')!;
  const top = Math.min(...loop.points.map(p => p.y));
  for (const n of t.anchors) if (n.id !== 'c') assert.ok(!(n.y + n.h > top - 6 && n.y + n.h <= t.anchors.find(a => a.id === 'c')!.y), `${n.id} sits right above the loop of c`);
});

test('stateDiagram(): nodes appear with the figure (reveal) and a node id cannot be spotlighted', async () => {
  const sd = stateDiagram([S('a'), S('b')], [{from: 'a', to: 'b'}], {reveal: 2});
  const {laidOut} = await checkDiagram(diagram({theme: 'blue'}).add(sd, box({id: 'ext', title: '外部', reveal: 2}), connect('a', 'ext', {route: 'elbow'})));
  assert.equal(laidOut.connects[0].reveal, 2);
  await assert.rejects(() => checkDiagram(diagram({theme: 'blue', spotlight: 'a'}).add(stateDiagram([S('a'), S('b')], []))), /node inside a figure/);
});

const sharedRun = (edges: {from: string; to: string; points: {x: number; y: number}[]}[]): string | undefined => {
  const segs = edges.flatMap((e, k) => e.points.slice(1).map((q, m) => ({k, p: e.points[m], q})));
  for (let i = 0; i < segs.length; i++) for (let j = i + 1; j < segs.length; j++) {
    const a = segs[i], b = segs[j];
    if (a.k === b.k) continue;
    const vert = (s: typeof a): boolean => Math.abs(s.p.x - s.q.x) < 0.01, horiz = (s: typeof a): boolean => Math.abs(s.p.y - s.q.y) < 0.01;
    const over = (a1: number, a2: number, b1: number, b2: number): number => Math.min(Math.max(a1, a2), Math.max(b1, b2)) - Math.max(Math.min(a1, a2), Math.min(b1, b2));
    if (vert(a) && vert(b) && Math.abs(a.p.x - b.p.x) < 1 && over(a.p.y, a.q.y, b.p.y, b.q.y) > 1) return `arrows ${edges[a.k].from}->${edges[a.k].to} and ${edges[b.k].from}->${edges[b.k].to} share a vertical run at x=${a.p.x}`;
    if (horiz(a) && horiz(b) && Math.abs(a.p.y - b.p.y) < 1 && over(a.p.x, a.q.x, b.p.x, b.q.x) > 1) return `arrows ${edges[a.k].from}->${edges[a.k].to} and ${edges[b.k].from}->${edges[b.k].to} share a horizontal run at y=${a.p.y}`;
  }
  return undefined;
};

test('stateDiagram(): five arrows out of one state each have their own vertical run (no shared line), in both directions', async () => {
  for (const dir of ['right', 'down'] as const) {
    const names = ['b', 'c', 'd', 'e', 'f'];
    const {t, verdict} = await laid(stateDiagram([S('a'), ...names.map(n => S(n))], names.map(n => ({from: 'a', to: n, label: `ev${n}`})), {dir}));
    assert.deepEqual(verdict.problems, [], dir);
    assert.equal(sharedRun(t.edges), undefined, dir);
  }
});
