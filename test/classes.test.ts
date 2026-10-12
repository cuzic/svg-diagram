import test from 'node:test';
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
    for (let i = 0; i < t.nodes.length; i++) for (let j = i + 1; j < t.nodes.length; j++) assert.ok(!overlap(t.nodes[i], t.nodes[j]));
    const by = (id: string) => t.anchors.find(a => a.id === id)!;
    if (dir === 'down') assert.ok(by('Shape').y + by('Shape').h <= by('Circle').y && by('Shape').y < by('Rect').y);
    else assert.ok(by('Shape').x + by('Shape').w <= by('Circle').x);
  });
}

test('classDiagram() compartments: dividers only where there is content; stereotype and abstract are shown', async () => {
  const {t} = await laid(model());
  const nodeOf = (id: string) => t.nodes[t.anchors.findIndex(a => a.id === id)];
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
  assert.ok(on(inh.points[0], by('Circle')) && on(inh.points[inh.points.length - 1], by('Shape')));
  const agg = t.edges.find(e => e.kind === 'aggregate')!;
  assert.ok(on(agg.points[0], by('Canvas')) && on(agg.points[agg.points.length - 1], by('Shape')));
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
  const {verdict} = await checkDiagram(diagram({theme: 'blue'}).add(c, box({id: 'doc', title: '仕様書'}), connect('Style', 'doc', {route: 'elbow'})));
  assert.deepEqual(verdict.problems.filter(p => !/crosses|connector/.test(p)), []);
});

test('classDiagram() rejects bad input', async () => {
  assert.throws(() => classDiagram([], []), /at least one class/);
  assert.throws(() => classDiagram([{id: 'a'}], [], {dir: 'up' as never}), /dir must be/);
  const bad = (cs: object[], rs: object[]) => checkDiagram(diagram({theme: 'blue'}).add(classDiagram(cs as never, rs as never)));
  await assert.rejects(() => bad([{id: 'a'}, {id: 'a'}], []), /duplicate class id "a"/);
  await assert.rejects(() => bad([{id: 'a'}], [{from: 'a', to: 'zz'}]), /unknown class "zz"/);
  await assert.rejects(() => bad([{id: 'a'}, {id: 'b'}], [{from: 'a', to: 'b', kind: 'friend'}]), /has kind friend/);
});
