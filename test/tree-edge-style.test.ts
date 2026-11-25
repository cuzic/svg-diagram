// ADR 0081 U1: TreeItem.edge — the colour and line kind of the line from a parent to a child.
import test from 'node:test';
import assert from 'node:assert/strict';
import './helpers/strict-width.ts'; // a label the layout did not register for measuring throws instead of measuring 0 wide
import {checkDiagram, closeMeasurer, diagram, mindmap, renderDiagram, tree} from '../lib/dsl.ts';
import {PALETTE, colorOf} from '../lib/tokens.ts';
import {assignEdgeStyles, compareEdgeOrder, edgeStrokes, hasStyledEdge, isOnePath} from '../lib/tree-edge-style.ts';
import type {Band} from '../lib/types/index.ts';
import type {LaidOutTree, MindmapLayout, TreeItem} from '../lib/types/diagrams.ts';

test.after(() => closeMeasurer());

type Edge = NonNullable<TreeItem['edge']>;
const PRO: Edge = {tone: 'accent'}, CON: Edge = {tone: 'danger', line: 'dashed'};
const topic = (pro: Edge | null = PRO, con: Edge | null = CON): TreeItem => ({
  label: '導入するか', id: 'root',
  children: [
    {label: '費用が下がる', id: 'p1', ...(pro ? {edge: pro} : {}), children: [{label: '保守費が減る', id: 'p1a', ...(pro ? {edge: pro} : {})}]},
    {label: '現場が楽になる', id: 'p2', ...(pro ? {edge: pro} : {})},
    {label: '移行に時間がかかる', id: 'c1', ...(con ? {edge: con} : {}), children: [{label: '教育が要る', id: 'c1a', ...(con ? {edge: con} : {})}, {label: '旧データの整理', id: 'c1b'}]},
    {label: '契約が複雑', id: 'c2', ...(con ? {edge: con} : {})},
  ],
});
const LAYOUTS: MindmapLayout[] = ['radial', 'right', 'left', 'down', 'up', 'org', 'list'];
const place = async (band: Band) => {
  const r = await checkDiagram(diagram({theme: 'blue'}).add(band));
  const t = r.laidOut.laidOut.find(b => b.type === 'tree') as LaidOutTree;
  return {t, verdict: r.verdict};
};
const svgOf = async (band: Band, opts: object = {}): Promise<string> => (await renderDiagram(diagram({theme: 'blue', ...opts}).add(band), {name: 'e.svg', budget: 'cacheOnly'})).svg;
const paths = (svg: string): string[] => svg.match(/<path d="M[^"]*" fill="none" stroke="#[0-9a-f]{6}" stroke-width="[24]"[^>]*\/>/g) ?? [];
const idxOf = (t: LaidOutTree, id: string): number => t.nodes.findIndex(n => n.id === id);
const edgeTo = (t: LaidOutTree, id: string) => t.edges.find(e => e.to === idxOf(t, id))!;
const lastLen = (e: LaidOutTree['edges'][number]): number => { const [p, q] = e.points.slice(-2); return Math.abs(p!.x - q!.x) + Math.abs(p!.y - q!.y); };
const DEF = {tone: 'muted', line: 'solid'};

for (const layout of LAYOUTS) {
  test(`edge, layout '${layout}': siblings that differ share a muted solid trunk, the item's own last segment takes its look`, async () => {
    const {t, verdict} = await place(mindmap(topic(), {layout}));
    assert.deepEqual(verdict.problems, [], layout);
    const p2 = edgeTo(t, 'p2'), c2 = edgeTo(t, 'c2'), c1b = edgeTo(t, 'c1b');
    assert.deepEqual(c2.style, {tone: 'danger', line: 'dashed'}, layout);
    if (layout !== 'radial') assert.deepEqual(c2.trunk, DEF, `${layout}: the root's children differ, so the trunk is the default`); // (radial splits them into two sides: its own test)
    assert.deepEqual(p2.style, {tone: 'accent', line: 'solid'}, layout);
    assert.equal(c1b.style, undefined, 'an item without edge stays plain');
    // c1's children: c1a is dashed danger, c1b is plain -> they differ: c1a has a trunk of the default
    assert.deepEqual(edgeTo(t, 'c1a').trunk, DEF, layout);
  });
  test(`edge, layout '${layout}': the item's own segment is 24px or more (22 on the grid)`, async () => {
    const {t} = await place(mindmap(topic(), {layout}));
    for (const e of t.edges) if (e.style) assert.ok(lastLen(e) >= 24 - 0.01, `${layout}: ${t.nodes[e.to!]?.id} own segment ${lastLen(e)}`);
  });
}

test('edge, S = T: siblings that are all dashed share one unbroken dashed path (no trunk, one path each)', async () => {
  const dashed: Edge = {line: 'dashed'};
  const band = mindmap({label: '根', children: [{label: 'ア', edge: dashed}, {label: 'イ', edge: dashed}, {label: 'ウ', edge: dashed}]}, {layout: 'right'});
  const {t} = await place(band);
  for (const e of t.edges) { assert.deepEqual(e.style, {tone: 'muted', line: 'dashed'}); assert.equal(e.trunk, undefined); }
  const ps = paths(await svgOf(band));
  assert.equal(ps.length, 3);
  assert.ok(ps.every(p => p.includes('stroke-dasharray="6,4"') && p.includes(`stroke="${PALETTE.muted}"`)));
});

test('edge, S != T: two paths, the trunk plain and the last segment in the look of the item', async () => {
  const band = mindmap({label: '根', children: [{label: 'ア', edge: {tone: 'danger', line: 'dotted'}}, {label: 'イ'}]}, {layout: 'right'});
  const svg = await svgOf(band);
  const ps = paths(svg);
  assert.equal(ps.length, 3, 'イ is one path, ア is two');
  const dotted = ps.filter(p => p.includes('stroke-dasharray="2,5"'));
  assert.equal(dotted.length, 1);
  assert.match(dotted[0]!, /stroke-linecap="round"/);
  assert.ok(dotted[0]!.includes(`stroke="${colorOf('danger', 'blue')}"`));
  assert.equal((dotted[0]!.match(/ L/g) ?? []).length, 1, 'the last segment only: M and one L');
  assert.equal(ps.filter(p => p.includes(`stroke="${PALETTE.muted}"`) && !p.includes('dasharray')).length, 2, 'the trunk of ア and the whole line of イ');
});

test('edge, radial: the two sides are different groups (siblings on the left do not change the trunk of the right)', async () => {
  const band = mindmap({label: '根', children: [
    {label: '右1', id: 'r1', edge: {line: 'dashed'}}, {label: '右2', id: 'r2', edge: {line: 'dashed'}},
    {label: '左1', id: 'l1'}, {label: '左2', id: 'l2', edge: PRO},
  ]}, {layout: 'radial', sides: {r1: 'right', r2: 'right', l1: 'left', l2: 'left'}});
  const {t} = await place(band);
  assert.equal(edgeTo(t, 'r1').trunk, undefined, 'both on the right are dashed: one dashed path');
  assert.equal(edgeTo(t, 'r2').trunk, undefined);
  assert.deepEqual(edgeTo(t, 'l2').trunk, DEF, 'on the left they differ');
});

test('edge, org: the root children share one drop whatever side of the bus they hang on', async () => {
  const band = mindmap({label: '本部', children: [{label: 'ア', id: 'a', edge: CON}, {label: 'イ', id: 'b'}, {label: 'ウ', id: 'c', edge: CON}]}, {layout: 'org'});
  const {t} = await place(band);
  assert.deepEqual(edgeTo(t, 'a').trunk, DEF);
  assert.deepEqual(edgeTo(t, 'c').trunk, DEF);
  assert.equal(edgeTo(t, 'b').trunk, undefined);
  assert.equal(lastLen(edgeTo(t, 'a')) >= 24, true);
});

test('assignEdgeStyles: a two-point line and a funnel (from) line belong to no group; a lit/non-lit pair follows the focus table', () => {
  const items: TreeItem[] = [{label: 'root'}, {label: 'a', edge: CON}, {label: 'b', edge: CON}, {label: 'c'}, {label: 'd', edge: PRO, from: 'x'}];
  const mk = (to: number, pts: number): LaidOutTree['edges'][number] => ({points: Array.from({length: pts}, (_, i) => ({x: i === 0 ? 0 : i, y: i === 0 ? 0 : i * 3})), from: 0, to});
  const edges = [mk(1, 4), mk(2, 2), mk(3, 4), mk(4, 4)];
  assignEdgeStyles(edges, e => items[e.to!], false);
  assert.deepEqual(edges[0]!.trunk, DEF, 'a (4 points) differs from c in its group');
  assert.equal(edges[1]!.trunk, undefined, 'a 2-point line has no trunk');
  assert.deepEqual(edges[1]!.style, {tone: 'danger', line: 'dashed'});
  assert.equal(edges[3]!.trunk, undefined, 'a funnel line has no trunk');
});

test('focus: a line that is not lit is muted with its own line kind, a lit one is accent with a solid trunk; dim mutes everything but keeps the line kind', async () => {
  const day = 'blue' as const;
  const {t} = await place(mindmap(topic(), {layout: 'right', focus: 'p1a'}));
  const c2 = edgeTo(t, 'c2'), p1 = edgeTo(t, 'p1');
  assert.deepEqual(c2.style, {tone: 'muted', line: 'dashed'}, 'danger is not used on an unlit line; the dashes stay');
  assert.deepEqual(c2.trunk, DEF);
  assert.equal(p1.lit, true);
  const env = {styles: {}} as never;
  assert.deepEqual(edgeStrokes(p1, false, day, env), {own: {color: colorOf('accent', day), line: 'solid'}, trunk: {color: colorOf('accent', day), line: 'solid'}});
  assert.deepEqual(edgeStrokes(c2, true, day, env), {own: {color: PALETTE.muted, line: 'dashed'}, trunk: {color: PALETTE.muted, line: 'solid'}});
  const litDashed = {...p1, style: {tone: 'danger' as const, line: 'dashed' as const}};
  assert.equal(edgeStrokes(litDashed, false, day, env).own.line, 'dashed', 'a lit dashed line stays dashed');
  assert.equal(edgeStrokes(litDashed, false, day, env).own.color, colorOf('accent', day), 'danger lit becomes accent');
  // draw order: default, styled, lit
  const svg = await svgOf(mindmap(topic(), {layout: 'right', focus: 'p1a'}));
  const ps = paths(svg), accent = colorOf('accent', 'blue');
  const lastAccent = ps.map(p => p.includes(`stroke="${accent}"`)).lastIndexOf(false);
  assert.ok(ps.findIndex(p => p.includes(`stroke="${accent}"`)) > lastAccent, 'lit lines come last');
  assert.ok(ps.findIndex(p => p.includes('dasharray')) > ps.findIndex(p => !p.includes('dasharray')), 'plain lines come before styled ones');
});

test('errors: one line saying what is wrong and how to fix it', () => {
  const bad = (f: () => unknown, re: RegExp) => assert.throws(f, e => re.test((e as Error).message) && !(e as Error).message.includes('\n'));
  bad(() => mindmap({label: '根', edge: PRO}), /根.*edge は書けません/);
  for (const layout of ['brace', 'fishbone', 'timeline'] as const) bad(() => mindmap(topic(), {layout}), new RegExp(`layout: '${layout}' では使えません`));
  bad(() => mindmap(topic(), {edges: false}), /edges: false.*使えません/);
  bad(() => tree(topic(), {edges: false}), /edges: false.*使えません/);
  bad(() => tree({label: 'a', children: [{label: 'b', edge: {tone: 'bogus' as never}}]}), /edge\.tone が bogus/);
  bad(() => tree({label: 'a', children: [{label: 'b', edge: {line: 'wavy' as never}}]}), /edge\.line が wavy/);
  bad(() => tree({label: 'a', children: [{label: 'b', from: 'x', edge: PRO}]}), /from.*edge/);
});

test('an item with a band node child: the own segment is 22px or more', async () => {
  const {chevron} = await import('../lib/dsl.ts');
  const r = await checkDiagram(diagram({theme: 'blue', width: 940}).add(tree({label: 'top', w: 600, band: chevron([{label: 'a1'}, {label: 'a2'}]), children: [{label: 'sub', w: 300, band: chevron([{label: 'b1'}]), edge: CON}, {label: 'sub2', w: 300, band: chevron([{label: 'c1'}])}]})));
  const t = r.laidOut.laidOut.find(b => b.type === 'tree') as LaidOutTree;
  for (const e of t.edges) if (e.style) assert.ok(lastLen(e) >= 22, `own segment ${lastLen(e)}`);
});

test('no edge, or a default edge: the same svg to the byte, and the layout is not widened', async () => {
  for (const layout of ['radial', 'right', 'org', 'list'] as const) {
    const plain = await svgOf(mindmap(topic(null, null), {layout}));
    for (const same of [{}, {tone: 'muted', line: 'solid'}] as Edge[]) {
      const withDefault = mindmap({label: '根', children: [{label: 'ア', edge: same}, {label: 'イ'}]}, {layout});
      const without = mindmap({label: '根', children: [{label: 'ア'}, {label: 'イ'}]}, {layout});
      assert.equal(await svgOf(withDefault), await svgOf(without), `${layout} ${JSON.stringify(same)}`);
    }
    assert.ok(!plain.includes('stroke-dasharray'), layout);
  }
});

test('pptx: a dashed / dotted line is prstDash dash / sysDot, in the freeform fallback too; a plain tree has no prstDash', async () => {
  const {prepareBands} = await import('../lib/core.ts');
  const {planPreparedPptx} = await import('../lib/pptx/selective.ts');
  const {treePptx} = await import('../lib/pptx/tree-band.ts');
  const {mindmap: bandMindmap} = await import('../lib/bands/tree.ts');
  const opts = {measure: ({text, size}: {text: string; size: number}) => ({w: [...text].length * size * 0.6, h: size}), title: '導入'};
  const xmlOf = async (items: TreeItem) => planPreparedPptx(await prepareBands([bandMindmap(items, {layout: 'right'})], opts), {...opts, bands: {tree: treePptx}, strict: true}).plan.xml;
  const x = await xmlOf({label: '根', children: [{label: 'ア', edge: CON}, {label: 'イ', edge: {line: 'dotted'}}, {label: 'ウ'}]});
  assert.equal((x.match(/<a:prstDash val="dash"\/>/g) ?? []).length, 1);
  assert.equal((x.match(/<a:prstDash val="sysDot"\/>/g) ?? []).length, 1);
  const plain = await xmlOf({label: '根', children: [{label: 'ア'}, {label: 'イ'}, {label: 'ウ'}]});
  assert.ok(!plain.includes('prstDash'));
  // a zig-zag no connector preset fits: the freeform keeps the dash
  const {treeXml} = await import('../lib/pptx/tree.ts');
  const laidTree: LaidOutTree = {type: 'tree', x: 0, y: 0, w: 200, h: 200, nodes: [{x: 0, y: 0, w: 40, h: 20, tone: 'plain'}, {x: 100, y: 160, w: 40, h: 20, tone: 'plain', parent: 0}], edges: [{points: [{x: 20, y: 20}, {x: 20, y: 40}, {x: 60, y: 40}, {x: 60, y: 80}, {x: 100, y: 80}, {x: 100, y: 120}, {x: 120, y: 120}, {x: 120, y: 160}], from: 0, to: 1, style: {tone: 'danger', line: 'dashed'}}], texts: [], anchors: [], labelBoxes: []};
  let n = 1;
  const shapes = treeXml(laidTree, {day: 'blue'} as never, {styles: {}} as never, {} as never, () => n++);
  assert.match(shapes.xml, /<a:custGeom>[\s\S]*<a:prstDash val="dash"\/>/);
});

test('hasStyledEdge, isOnePath, compareEdgeOrder: the small rules', () => {
  assert.equal(hasStyledEdge([{label: 'a'}, {label: 'b', edge: {}}, {label: 'c', edge: {tone: 'muted', line: 'solid'}}]), false);
  assert.equal(hasStyledEdge([{label: 'a'}, {label: 'b', edge: {line: 'dotted'}}]), true);
  assert.equal(isOnePath({color: '#000000', line: 'solid'}, {color: '#000000', line: 'solid'}), true);
  assert.equal(isOnePath({color: '#000000', line: 'dashed'}, {color: '#000000', line: 'solid'}), false);
  const pt = [{x: 0, y: 0}, {x: 1, y: 1}], plain = {points: pt}, styled = {points: pt, style: DEF as never}, lit = {points: pt, lit: true as const};
  assert.deepEqual([lit, styled, plain].toSorted(compareEdgeOrder), [plain, styled, lit]);
});
