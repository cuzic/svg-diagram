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

test('density compact: a cause tree whose compact figure would put an arrow through a box is drawn at the normal gaps', async () => {
  // fz #43 of the review (real fonts, 1800px): compact alone runs `n0 -> n4` through `n1`. The band falls back to the normal gaps, so the check finds nothing wrong.
  const {causeTree, diagram, checkDiagram} = await import('../lib/dsl.ts');
  const nodes = Array.from({length: 10}, (_, i) => ({id: `n${i}`, label: `n${i} ${'あ'.repeat(3 + (i * 5) % 11)}`}));
  const links = [{from: 'n0', to: 'n1'}, {from: 'n0', to: 'n2'}, {from: 'n1', to: 'n3'}, {from: 'n1', to: 'n4'}, {from: 'n0', to: 'n4'}, {from: 'n3', to: 'n5'}, {from: 'n2', to: 'n6'}, {from: 'n0', to: 'n6'}, {from: 'n6', to: 'n7'}, {from: 'n0', to: 'n7'}, {from: 'n7', to: 'n8'}, {from: 'n4', to: 'n8'}, {from: 'n3', to: 'n9'}];
  const run = async (density: 'normal' | 'compact') => (await checkDiagram(diagram({theme: 'blue', width: 1800, density}).add(causeTree(nodes, links, {dir: 'right'}) as never))).verdict.problems;
  const normal = await run('normal'), compact = await run('compact');
  assert.deepEqual(compact.filter(p => /runs through/.test(p) && !normal.includes(p)), []);
});

test('density: only normal and compact; a number is not a density', async () => {
  const {diagram} = await import('../lib/dsl.ts');
  assert.throws(() => diagram({theme: 'blue', density: 0.6 as never}), /diagram\(\{density\}\) must be 'normal' or 'compact'/);
  assert.throws(() => diagram({theme: 'blue', density: 'tight' as never}), /diagram\(\{density\}\) must be 'normal' or 'compact'/);
});

test.after(async () => { await closeMeasurer(); });
