import assert from 'node:assert/strict';
import path from 'node:path';
import {register} from 'node:module';
import test from 'node:test';
import './helpers/strict-width.ts';
import {loadConfig} from '../lib/config.ts';
import {loadDiagram} from '../lib/load-source.ts';
import {renderDiagram} from '../lib/dsl/render.ts';
import {closeMeasurer} from '../lib/measure.ts';

register(new URL('../lib/resolve-hook.ts', import.meta.url)); // the examples import 'svg-diagram'

// ADR 0036: `diagram({density: 'compact'})` closes the gaps of the layered figures. Fixed text widths (strict-width), the figures of examples/.
const EXAMPLES = path.resolve(import.meta.dirname, '../examples');
const config = loadConfig();
type Rendered = {svg: string; h: number; problems: string[]; band: any};
async function render(name: string, density?: 'compact'): Promise<Rendered> {
  const d: any = await loadDiagram(path.join(EXAMPLES, name + '.ts'), config);
  if (density) d.density = density;
  const r: any = await renderDiagram(d, {name: name + '.svg', budget: 'cacheOnly'});
  const h = Number(/<svg[^>]*?height="([\d.]+)"/.exec(r.svg)![1]);
  return {svg: r.svg, h, problems: r.verdict.problems, band: r.laidOut.laidOut.find((b: any) => ['cause', 'states', 'classes', 'tree', 'fta', 'bpmn'].includes(b.type))};
}

// every layered figure of the examples: compact adds no problem, is never taller, and 'normal' written is the same figure as nothing written
for (const name of ['toc-crt', 'toc-frt', 'toc-prt', 'qc-pdpc', 'qc-relation', 'state-diagram', 'qc-arrow', 'qc-arrow-long', 'class-diagram', 'org-chart', 'org-chart-right', 'mindmap', 'fta', 'bpmn']) {
  test(`density compact: ${name} adds no problem and is not taller`, async () => {
    const normal = await render(name), compact = await render(name, 'compact');
    assert.deepEqual(compact.problems.filter(p => !normal.problems.includes(p)), [], 'no new problem');
    assert.ok(compact.h <= normal.h, `${normal.h} -> ${compact.h}`);
  });
}

test("density: 'normal' is the figure that nothing written is", async () => {
  const plain = await render('toc-crt'), normal = await (async () => {
    const d: any = await loadDiagram(path.join(EXAMPLES, 'toc-crt.ts'), config);
    d.density = 'normal';
    return (await renderDiagram(d, {name: 'x.svg', budget: 'cacheOnly'})).svg;
  })();
  assert.equal(normal, plain.svg);
});

test('density compact: the cause trees, state diagrams, organisation charts and fault trees get lower', async () => {
  for (const [name, by] of [['toc-crt', 0.9], ['toc-frt', 0.9], ['qc-pdpc', 0.9], ['org-chart', 0.95], ['fta', 0.98]] as const) {
    const normal = await render(name), compact = await render(name, 'compact');
    assert.ok(compact.h < normal.h * by, `${name}: ${normal.h} -> ${compact.h}`);
  }
});

// ADR 0036 D3: what density does not close. Class diagrams keep the gap between the boxes of a layer and the lanes of the arrows (the multiplicity labels sit there:
// closing them made "1" and "1..*" overlap); a state diagram keeps the width of its widest transition label between the layers.
test('density compact: class diagram keeps the gap between the boxes of one layer', async () => {
  const gaps = (band: any): number[] => {
    const down = band.dir !== 'right', layers = new Map<number, any[]>();
    for (const n of band.nodes) { const k = Math.round(down ? n.y : n.x); layers.set(k, [...(layers.get(k) ?? []), n]); }
    return [...layers.values()].flatMap(ns => { const s = ns.sort((a, b) => down ? a.x - b.x : a.y - b.y); return s.slice(1).map((n, i) => down ? n.x - (s[i].x + s[i].w) : n.y - (s[i].y + s[i].h)); }).sort((a, b) => a - b);
  };
  const normal = await render('class-diagram'), compact = await render('class-diagram', 'compact');
  assert.deepEqual(gaps(compact.band), gaps(normal.band));
});

test('density compact: a state diagram keeps the width of its transition labels between the layers (only the two stubs shrink: 2 x 4px)', async () => {
  // the arrow diagram of the review: with the label width scaled too, the label of 2 -> 4 sat on its line
  const layerGaps = (band: any): number[] => {
    const nodes: any[] = band.nodes, xs = [...new Set<number>(nodes.map(n => Math.round(n.x)))].sort((a, b) => a - b);
    return xs.slice(1).map((x, i) => x - xs[i] - Math.max(...nodes.filter(n => Math.round(n.x) === xs[i]).map(n => n.w)));
  };
  for (const name of ['qc-arrow', 'state-diagram']) {
    const normal = await render(name), compact = await render(name, 'compact');
    assert.ok(Math.min(...layerGaps(compact.band)) >= Math.min(...layerGaps(normal.band)) - 8.5, `${name}: ${layerGaps(normal.band)} -> ${layerGaps(compact.band)}`);
    assert.deepEqual(compact.problems, []);
  }
});

test('density compact: the stub and the lane step of the arrows follow the scale (and the detour starts at the same stub)', async () => {
  const {stubOf, laneStepOf, gapFor} = await import('../lib/layered-route.ts');
  assert.equal(stubOf(), 18); assert.equal(laneStepOf(), 14);
  assert.equal(stubOf(0.75), 14); assert.equal(laneStepOf(0.75), 11);
  assert.equal(gapFor(1, 0, 1), 2 * 18 + 16); // the normal gap is what it was
  assert.ok(gapFor(3, 0, 0.75) < gapFor(3, 0, 1));
});

// fz #43 of the review (real figure of the random cause trees; 1800px): compact alone runs the arrow n0 -> n4 through n1 (checked: that is what happens without the fall back).
const C43 = {
  nodes: [['n0', 'n0 ああああああああ'], ['n1', 'n1 ああああああああああああああ'], ['n2', 'n2 ああああああああああああああ'], ['n3', 'n3 ああああああああああああああ'], ['n4', 'n4 ああああああああああああああ'], ['n5', 'n5 ああああああ'], ['n6', 'n6 あああああああ'], ['n7', 'n7 あああああ']].map(([id, label]) => ({id, label})),
  links: JSON.parse('[{"from":"n0","to":"n1"},{"from":"n1","to":"n2"},{"from":"n1","to":"n3"},{"from":"n3","to":"n4"},{"from":"n1","to":"n4"},{"from":"n1","to":"n5"},{"from":"n0","to":"n6"},{"from":"n5","to":"n7"},{"from":"n0","to":"n7"},{"from":["n0","n2"],"to":"n4"}]'),
};
test('density compact: a cause tree whose compact gaps would put an arrow through a box is drawn at the normal gaps (c43 of the review)', async () => {
  const {causeTree, diagram, checkDiagram} = await import('../lib/dsl.ts');
  const run = async (density: 'normal' | 'compact') => (await checkDiagram(diagram({theme: 'blue', width: 1800, density}).add(causeTree(C43.nodes, C43.links, {dir: 'left'}) as never))).verdict.problems;
  const normal = await run('normal'), compact = await run('compact');
  assert.deepEqual(compact.filter(p => !normal.includes(p)), [], JSON.stringify(compact));
});

// c123 of the review: this figure fits 1800px only at the compact gaps (the normal gaps do not fit: "does not fit 1760px"), and one arrow runs through a box there.
const C123 = {nodes: [['n0', 'n0 あああああああああああ'], ['n1', 'n1 ああああああああ'], ['n2', 'n2 あああああああ'], ['n3', 'n3 あああああああああ'], ['n4', 'n4 あああ'], ['n5', 'n5 あああああああ'], ['n6', 'n6 ああああああああ'], ['n7', 'n7 ああああああああああああ'], ['n8', 'n8 あああああああああ'], ['n9', 'n9 ああああ'], ['n10', 'n10 あああああああ'], ['n11', 'n11 ああああああああああああああ'], ['n12', 'n12 あああああああああ'], ['n13', 'n13 ああああああ'], ['n14', 'n14 ああああああああ'], ['n15', 'n15 ああああああ']].map(([id, label]) => ({id, label})), links: JSON.parse('[{"from":"n0","to":"n1"},{"from":"n1","to":"n2"},{"from":"n0","to":"n3"},{"from":"n1","to":"n4"},{"from":"n2","to":"n4"},{"from":"n0","to":"n5"},{"from":"n2","to":"n6"},{"from":"n4","to":"n6"},{"from":"n6","to":"n7"},{"from":"n1","to":"n7"},{"from":"n5","to":"n8"},{"from":"n8","to":"n9"},{"from":"n4","to":"n9"},{"from":"n4","to":"n10"},{"from":"n6","to":"n11"},{"from":"n1","to":"n11"},{"from":"n10","to":"n12"},{"from":"n7","to":"n13"},{"from":"n9","to":"n13"},{"from":"n6","to":"n14"},{"from":"n3","to":"n14"},{"from":"n2","to":"n15"},{"from":"n1","to":"n15"},{"from":["n0","n14"],"to":"n15"}]')};
test('density compact: a compact figure that fits only because it is compact stays, and the check says what is wrong with it (the arrow through a box), not "does not fit"', async () => {
  const {causeTree, diagram, checkDiagram} = await import('../lib/dsl.ts');
  const {verdict} = await checkDiagram(diagram({theme: 'blue', width: 1800, density: 'compact'}).add(causeTree(C123.nodes, C123.links, {dir: 'left'}) as never));
  assert.ok(verdict.problems.every(p => /runs through/.test(p)), JSON.stringify(verdict.problems));
});

test('density compact: a state diagram that the check finds more wrong at the compact gaps is drawn at the normal gaps (s61 of the review)', async () => {
  const {stateDiagram, diagram, checkDiagram} = await import('../lib/dsl.ts');
  // running down, with labelled transitions: the compact gaps put a label chip on another chip and on another arrow (3 of 88 random figures in the review)
  const states = [['s0', 's0 ああああああ'], ['s1', 's1 ああああ'], ['s2', 's2 ああああ'], ['s3', 's3 ああああああ'], ['s4', 's4 あああああ'], ['s5', 's5 あああ']].map(([id, label]) => ({id, label}));
  const transitions = JSON.parse('[{"from":"s0","to":"s1"},{"from":"s1","to":"s2"},{"from":"s0","to":"s3","label":"いい"},{"from":"s1","to":"s3","label":"いいいい"},{"from":"s0","to":"s4","label":"いいいいい"},{"from":"s0","to":"s5","label":"い"},{"from":"s4","to":"s5","label":"いい"},{"from":"s4","to":"s0"},{"from":"s4","to":"s3"}]');
  const run = async (density: 'normal' | 'compact') => (await checkDiagram(diagram({theme: 'blue', width: 940, density}).add(stateDiagram(states, transitions, {initial: 's0', dir: 'down'}) as never))).verdict.problems;
  const normal = await run('normal'), compact = await run('compact');
  assert.deepEqual(compact.filter(p => !normal.includes(p)), [], JSON.stringify(compact));
});

test('density: only normal and compact; a number is not a density', async () => {
  const {diagram} = await import('../lib/dsl.ts');
  assert.throws(() => diagram({theme: 'blue', density: 0.6 as never}), /diagram\(\{density\}\) must be 'normal' or 'compact'/);
  assert.throws(() => diagram({theme: 'blue', density: 'tight' as never}), /diagram\(\{density\}\) must be 'normal' or 'compact'/);
});

test('statesProblems: a transition through a state, a chip on a state, on another chip, on another arrow or outside the figure; nothing for a clean figure', async () => {
  const {statesProblems} = await import('../lib/verify-base.ts');
  const fig = {x: 0, y: 0, w: 400, h: 100};
  const anchors = [{id: 'a', x: 0, y: 0, w: 60, h: 40}, {id: 'b', x: 300, y: 0, w: 60, h: 40}, {id: 'c', x: 150, y: 0, w: 60, h: 40}];
  const edges = [{from: 'a', to: 'b', points: [{x: 60, y: 20}, {x: 300, y: 20}]}, {from: 'a', to: 'c', points: [{x: 30, y: 40}, {x: 30, y: 80}, {x: 180, y: 80}, {x: 180, y: 40}]}];
  assert.deepEqual(statesProblems({...fig, edges: [edges[1]], anchors, labels: [{x: 80, y: 60, w: 30, h: 12, text: 'ok', edge: 0}]}), []);
  assert.match(statesProblems({...fig, edges, anchors, labels: []}).join('|'), /transition a -> b runs through state "c"/);
  const labels = [{x: 80, y: 74, w: 40, h: 12, text: 'one', edge: 1}, {x: 100, y: 76, w: 40, h: 12, text: 'two', edge: 1}, {x: 380, y: 60, w: 40, h: 12, text: 'out', edge: 1}, {x: 155, y: 10, w: 20, h: 12, text: 'on', edge: 1}];
  const found = statesProblems({...fig, edges: [edges[1]], anchors, labels}).join('|');
  assert.match(found, /label "one" overlaps label "two"/);
  assert.match(found, /label "out" runs outside the figure/);
  assert.match(found, /label "on" overlaps state "c"/);
  assert.match(statesProblems({...fig, edges, anchors: [anchors[0], anchors[1]], labels: [{x: 100, y: 14, w: 30, h: 12, text: 'chip', edge: 1}]}).join('|'), /label "chip" sits on the arrow a -> b/);
});

test.after(async () => { await closeMeasurer(); });
