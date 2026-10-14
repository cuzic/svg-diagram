import test from 'node:test';
import './helpers/strict-width.ts'; // a label the layout did not register for measuring throws instead of measuring 0 wide
import assert from 'node:assert/strict';
import {box, checkDiagram, classDiagram, closeMeasurer, connect, diagram, renderDiagram} from '../lib/dsl.ts';
import type {LaidOutClasses} from '../lib/types.ts';

test.after(() => closeMeasurer());

const model = (opts: object = {}) => classDiagram(
  [
    {id: 'Shape', abstract: true, methods: ['+ area(): number']},
    {id: 'Circle', attrs: ['- r: number'], methods: ['+ area(): number']},
    {id: 'Rect', attrs: ['- w: number', '- h: number']},
    {id: 'Canvas', attrs: ['- shapes: Shape[]']},
    {id: 'Style', stereotype: 'enum'},
  ],
  [
    {from: 'Circle', to: 'Shape', kind: 'inherit'}, {from: 'Rect', to: 'Shape', kind: 'inherit'},
    {from: 'Canvas', to: 'Shape', kind: 'aggregate', fromMult: '1', toMult: '0..*', label: '描く'},
    {from: 'Canvas', to: 'Style', kind: 'depend'}, {from: 'Canvas', to: 'Canvas', kind: 'assoc', label: '入れ子'},
  ],
  opts,
);

const laid = async (...bands: unknown[]) => {
  const {laidOut, verdict} = await checkDiagram(diagram({theme: 'blue'}).add(...(bands as never[])));
  return {t: laidOut.laidOut.find(b => b.type === 'classes') as LaidOutClasses, verdict};
};
const overlap = (a: {x: number; y: number; w: number; h: number}, b: {x: number; y: number; w: number; h: number}): boolean => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

for (const dir of ['down', 'right'] as const) {
  test(`classDiagram() dir ${dir}: parents first, no overlaps, verify passes`, async () => {
    const {t, verdict} = await laid(model({dir}));
    assert.deepEqual(verdict.problems, []);
    assert.equal(t.nodes.length, 5);
    for (let i = 0; i < t.nodes.length; i++) for (let j = i + 1; j < t.nodes.length; j++) assert.ok(!overlap(t.nodes[i]!, t.nodes[j]!));
    const by = (id: string) => t.anchors.find(a => a.id === id)!;
    if (dir === 'down') assert.ok(by('Shape').y + by('Shape').h <= by('Circle').y && by('Shape').y < by('Rect').y);
    else assert.ok(by('Shape').x + by('Shape').w <= by('Circle').x);
  });
}

test('classDiagram() compartments: dividers only where there is content; stereotype and abstract are shown', async () => {
  const {t} = await laid(model());
  const nodeOf = (id: string) => t.nodes[t.anchors.findIndex(a => a.id === id)]!;
  assert.equal(nodeOf('Circle').dividers.length, 2);
  assert.equal(nodeOf('Shape').dividers.length, 1);
  assert.equal(nodeOf('Style').dividers.length, 0);
  assert.ok(t.texts.some(x => x.text === '«abstract»') && t.texts.some(x => x.text === '«enum»'));
});

test('classDiagram() inherit runs child -> parent and ends on the parent; the diamond of a whole is at its start', async () => {
  const {t} = await laid(model());
  const by = (id: string) => t.anchors.find(a => a.id === id)!;
  const on = (p: {x: number; y: number}, r: {x: number; y: number; w: number; h: number}): boolean => p.x >= r.x - 0.5 && p.x <= r.x + r.w + 0.5 && p.y >= r.y - 0.5 && p.y <= r.y + r.h + 0.5;
  const inh = t.edges.find(e => e.from === 'Circle' && e.kind === 'inherit')!;
  assert.ok(on(inh.points[0]!, by('Circle')) && on(inh.points[inh.points.length - 1]!, by('Shape')));
  const agg = t.edges.find(e => e.kind === 'aggregate')!;
  assert.ok(on(agg.points[0]!, by('Canvas')) && on(agg.points[agg.points.length - 1]!, by('Shape')));
  assert.equal(t.edges.find(e => e.kind === 'depend')!.line, 'dashed');
  assert.equal(t.labels.length, 4); // 描く, 1, 0..*, 入れ子
});

test('classDiagram() SVG: boxes, dividers, hollow triangle, diamond, dashed depend', async () => {
  const {svg} = await renderDiagram(diagram({theme: 'blue'}).add(model()), {name: 'c.svg', budget: 'cacheOnly'});
  assert.equal(svg.match(/<rect [^>]*rx="8"/g)?.length, 5);
  assert.match(svg, /stroke-dasharray="6,4"/);
  assert.match(svg, />«interface»|>«abstract»</);
  assert.match(svg, /fill="#ffffff" stroke="#22201b" stroke-width="2"/); // a hollow mark
});

test('classDiagram() classes are anchors for connect()', async () => {
  const c = model();
  assert.equal(c.anchors.Circle.id, 'Circle');
  const {verdict} = await checkDiagram(diagram({theme: 'blue'}).add(c, box({id: 'doc', title: '仕様書'}), connect('Circle', 'doc', {route: 'elbow'})));
  assert.deepEqual(verdict.problems, []);
});

test('classDiagram() rejects bad input', async () => {
  assert.throws(() => classDiagram([], []), /at least one class/);
  assert.throws(() => classDiagram([{id: 'a'}], [], {dir: 'up' as never}), /dir must be/);
  const bad = (cs: object[], rs: object[]) => checkDiagram(diagram({theme: 'blue'}).add(classDiagram(cs as never, rs as never)));
  await assert.rejects(() => bad([{id: 'a'}, {id: 'a'}], []), /duplicate class id "a"/);
  await assert.rejects(() => bad([{id: 'a'}], [{from: 'a', to: 'zz'}]), /unknown class "zz"/);
  await assert.rejects(() => bad([{id: 'a'}, {id: 'b'}], [{from: 'a', to: 'b', kind: 'friend'}]), /has kind friend/);
});

const sharedRun = (edges: {from: string; to: string; points: {x: number; y: number}[]}[]): string | undefined => {
  const segs = edges.flatMap((e, k) => e.points.slice(1).map((q, m) => ({k, p: e.points[m]!, q})));
  const over = (a1: number, a2: number, b1: number, b2: number): number => Math.min(Math.max(a1, a2), Math.max(b1, b2)) - Math.max(Math.min(a1, a2), Math.min(b1, b2));
  for (let i = 0; i < segs.length; i++) for (let j = i + 1; j < segs.length; j++) {
    const a = segs[i]!, b = segs[j]!;
    if (a.k === b.k) continue;
    if (Math.abs(a.p.x - a.q.x) < 0.01 && Math.abs(b.p.x - b.q.x) < 0.01 && Math.abs(a.p.x - b.p.x) < 1 && over(a.p.y, a.q.y, b.p.y, b.q.y) > 1) return `${edges[a.k]!.from}->${edges[a.k]!.to} and ${edges[b.k]!.from}->${edges[b.k]!.to} share a vertical run at x=${a.p.x}`;
    if (Math.abs(a.p.y - a.q.y) < 0.01 && Math.abs(b.p.y - b.q.y) < 0.01 && Math.abs(a.p.y - b.p.y) < 1 && over(a.p.x, a.q.x, b.p.x, b.q.x) > 1) return `${edges[a.k]!.from}->${edges[a.k]!.to} and ${edges[b.k]!.from}->${edges[b.k]!.to} share a horizontal run at y=${a.p.y}`;
  }
  return undefined;
};

test('classDiagram(): five subclasses of one base do not share a line; same-pair compose + depend labels stay off each other\'s lines', async () => {
  const subs = ['A1', 'A2', 'A3', 'A4', 'A5'];
  const {t, verdict} = await laid(classDiagram([{id: 'Base'}, ...subs.map(id => ({id}))], subs.map(from => ({from, to: 'Base', kind: 'inherit' as const}))));
  assert.deepEqual(verdict.problems, []);
  assert.equal(sharedRun(t.edges), undefined);
  const two = await laid(classDiagram([{id: 'A'}, {id: 'B'}], [{from: 'A', to: 'B', kind: 'compose', label: 'owns'}, {from: 'A', to: 'B', kind: 'depend', label: 'uses'}]));
  assert.deepEqual(two.verdict.problems, []);
  for (const l of two.t.labels) two.t.edges.forEach((e, k) => {
    if (k === l.edge) return;
    for (let m = 0; m + 1 < e.points.length; m++) {
      const p = e.points[m], q = e.points[m + 1];
      assert.ok(!overlap(l, {x: Math.min(p!.x, q!.x) - 1, y: Math.min(p!.y, q!.y) - 1, w: Math.abs(p!.x - q!.x) + 2, h: Math.abs(p!.y - q!.y) + 2}), `${l.text} sits on ${e.from} -> ${e.to}`);
    }
  });
});

test('classDiagram(): a self relation keeps its multiplicities and fits the figure; chips use the figure\'s note size (slide canvas)', async () => {
  const {t, verdict} = await laid(classDiagram([{id: 'Node', attrs: ['- next: Node']}], [{from: 'Node', to: 'Node', kind: 'aggregate', label: 'next', fromMult: '1', toMult: '0..1'}]));
  assert.deepEqual(verdict.problems, []);
  assert.deepEqual(t.labels.map(l => l.text).sort(), ['0..1', '1', 'next']);
  for (const l of t.labels) assert.ok(l.x + l.w <= t.x + t.w);
  const slide = await checkDiagram(diagram({canvas: 'slide', theme: 'blue'}).add(classDiagram([{id: 'A'}, {id: 'B'}], [{from: 'A', to: 'B', label: '使う'}])));
  const sl = slide.laidOut.laidOut.find(b => b.type === 'classes') as LaidOutClasses;
  assert.equal(sl.labels[0]!.size, slide.laidOut.roles.note);
});

test('classDiagram(): nodes appear with the figure (reveal); a class id cannot be spotlighted', async () => {
  const c = classDiagram([{id: 'A'}, {id: 'B'}], [{from: 'A', to: 'B'}], {reveal: 2});
  const {laidOut} = await checkDiagram(diagram({theme: 'blue'}).add(c, box({id: 'ext', title: '外部', reveal: 2}), connect('B', 'ext', {route: 'elbow'})));
  assert.equal(laidOut.connects[0]!.reveal, 2);
  await assert.rejects(() => checkDiagram(diagram({theme: 'blue', spotlight: 'A'}).add(classDiagram([{id: 'A'}], []))), /node inside a figure/);
});

test('classDiagram(): several classes depending on one (fan-in) do not cross; a connector to the whole figure is not stopped by its classes', async () => {
  const tails = ['A', 'B', 'C', 'D'];
  const {t, verdict} = await laid(classDiagram([...tails.map(id => ({id})), {id: 'Log'}], tails.map(from => ({from, to: 'Log', kind: 'depend' as const}))));
  assert.deepEqual(verdict.problems, []);
  for (let i = 0; i < t.edges.length; i++) for (let j = i + 1; j < t.edges.length; j++) {
    for (let a = 0; a + 1 < t.edges[i]!.points.length; a++) for (let b = 0; b + 1 < t.edges[j]!.points.length; b++) {
      const p = t.edges[i]!.points[a], q = t.edges[i]!.points[a + 1], r = t.edges[j]!.points[b], s = t.edges[j]!.points[b + 1];
      const iv = Math.abs(p!.x - q!.x) < 0.01, jv = Math.abs(r!.x - s!.x) < 0.01;
      if (iv === jv) continue;
      const [v1, v2, h1, h2] = iv ? [p, q, r, s] : [r, s, p, q];
      assert.ok(!(v1!.x > Math.min(h1!.x, h2!.x) + 0.5 && v1!.x < Math.max(h1!.x, h2!.x) - 0.5 && h1!.y > Math.min(v1!.y, v2!.y) + 0.5 && h1!.y < Math.max(v1!.y, v2!.y) - 0.5), `${t.edges[i]!.from}->Log crosses ${t.edges[j]!.from}->Log`);
    }
  }
  const fig = classDiagram([{id: 'A'}, {id: 'B'}, {id: 'C'}], [{from: 'A', to: 'B'}, {from: 'B', to: 'C'}], {id: 'CD'});
  const w = await checkDiagram(diagram({theme: 'blue'}).add(fig, box({id: 'ext', title: '外部'}), connect('CD', 'ext', {route: 'elbow'})));
  assert.deepEqual(w.verdict.problems, []);
});

test('classDiagram(): a complete 2x2 between two layers has no shared run', async () => {
  const {t, verdict} = await laid(classDiagram([{id: 'A'}, {id: 'B'}, {id: 'X'}, {id: 'Y'}], [{from: 'A', to: 'X', kind: 'arrow'}, {from: 'A', to: 'Y', kind: 'arrow'}, {from: 'B', to: 'X', kind: 'arrow'}, {from: 'B', to: 'Y', kind: 'arrow'}]));
  assert.deepEqual(verdict.problems, []);
  assert.equal(sharedRun(t.edges), undefined);
});

test('classDiagram() dir right: a self relation sits above its class, off the arrows that leave to the right, with its label and multiplicities', async () => {
  const {t, verdict} = await laid(classDiagram([{id: 'Node'}, {id: 'Next'}], [{from: 'Node', to: 'Node', kind: 'aggregate', label: 'next', fromMult: '1', toMult: '0..1'}, {from: 'Node', to: 'Next', kind: 'arrow'}], {dir: 'right'}));
  assert.deepEqual(verdict.problems, []);
  const node = t.anchors.find(a => a.id === 'Node')!, loop = t.edges.find(e => e.from === 'Node' && e.to === 'Node')!;
  assert.ok(loop.points.every(p => p.y <= node.y + 0.5), 'the loop is above the class');
  assert.deepEqual(t.labels.map(l => l.text).sort(), ['0..1', '1', 'next']);
  assert.ok(t.labels.every(l => l.y >= t.y - 0.5), 'inside the figure');
});

test('classDiagram() dir right: a self relation on the lower class of a layer leaves room above it (its label does not sit on the class above)', async () => {
  const {t, verdict} = await laid(classDiagram([{id: 'P'}, {id: 'A'}, {id: 'B'}], [{from: 'A', to: 'P', kind: 'inherit'}, {from: 'B', to: 'P', kind: 'inherit'}, {from: 'B', to: 'B', kind: 'aggregate', label: 'next', fromMult: '1', toMult: '0..1'}], {dir: 'right'}));
  assert.deepEqual(verdict.problems, []);
  const a = t.anchors.find(n => n.id === 'A')!, b = t.anchors.find(n => n.id === 'B')!;
  const upper = a.y < b.y ? a : b, lower = a.y < b.y ? b : a;
  for (const l of t.labels) assert.ok(!(l.y < upper.y + upper.h && l.y + l.h > upper.y && l.x < upper.x + upper.w && l.x + l.w > upper.x), `${l.text} is not on ${upper.id}`);
  void lower;
});
