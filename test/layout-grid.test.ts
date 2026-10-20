// node --test test/   — ADR 0014 U1: column edges are decided once per (width, columns, gap) on the 4px grid and shared by every row.
import test from 'node:test';
import assert from 'node:assert/strict';
import {gridColumns, rowChildGeometry} from '../lib/layout-util.ts';
import {box, diagram, group, row, quadrant, renderDiagram} from '../lib/dsl.ts';
import {snap4} from '../lib/emit-common.ts';
import type {LaidOutQuadrant} from '../lib/quadrant.ts';
import type {LaidOutBox} from '../lib/types/text-bands.ts';
import type {LaidOutGroup} from '../lib/types/containers.ts';
import type {Band} from '../lib/types/index.ts';
import {groupFillPlan} from '../lib/layout-handlers.ts';

const kids = (n: number) => Array.from({length: n}, () => ({}));
const edges = (g: {x: number[]; w: number[]}) => g.x.flatMap((x, i) => [x, x + g.w[i]!]);
const gutters = (g: {x: number[]; w: number[]}) => g.x.slice(1).map((x, k) => x - g.x[k]! - g.w[k]!);
const geo = (children: object[], opts: {cols?: number; gap?: number} = {}, width = 900) => rowChildGeometry({cols: opts.cols, gap: opts.gap ?? 16, justify: 'stretch', children}, width);

test('two equal halves of 900 with gap 16 are 440 + 20 + 440', () => {
  const g = gridColumns(900, 2, 16)!;
  assert.deepEqual(g.w, [440, 440]);
  assert.deepEqual(g.x, [0, 460]);
  assert.deepEqual(geo(kids(2)).widths, [440, 440]);
});

test('cols [6, 6]: equal frames on the grid, and the group title sits on the box column in both', async () => {
  const d = diagram({theme: 'blue', title: 't'}).add(row([group([box({title: 'a'})], {title: 'L'}), group([box({title: 'b'})], {title: 'R'})], {cols: [6, 6]}));
  const r = await renderDiagram(d, {name: 'x.svg', budget: 'cacheOnly'});
  assert.deepEqual(r.verdict.findings.filter(f => f.rule.startsWith('layout-')), []);
  const rects = [...r.svg.matchAll(/<rect x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="[\d.]+" rx="8" fill="(?!#fff|#ffffff)[^"]+"/g)].map(m => ({x: Number(m[1]), w: Number(m[3])}));
  assert.equal(rects.length, 2);
  assert.equal(rects[0]!.w, rects[1]!.w);
  for (const f of rects) { assert.equal(f.x % 4, 0); assert.equal((f.x + f.w) % 4, 0); }
  const title = (t: string) => Number(new RegExp(`<text x="([\\d.]+)"[^>]*>${t}</text>`).exec(r.svg)?.[1]);
  const boxX = [...r.svg.matchAll(/<rect x="([\d.]+)" y="[\d.]+" width="[\d.]+" height="[\d.]+" rx="8" fill="#(?:fff|ffffff)"/g)].map(m => Number(m[1])).filter(x => x !== 0);
  assert.equal(title('L') - rects[0]!.x, title('R') - rects[1]!.x, 'the same inset in the left and the right group (no 494 / 496)');
  assert.ok(boxX.includes(title('L')) && boxX.includes(title('R')), 'a title starts where the box under it starts');
});

test('property: edges on the grid (the emitter snap changes nothing), widths one step apart at most, even gutters', () => {
  let seed = 12345;
  const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  for (let i = 0; i < 600; i++) {
    const width = 200 + rnd() * 700 + (i % 3 === 0 ? 0 : rnd() * 4), n = 2 + Math.floor(rnd() * 11), gap = 8 + Math.floor(rnd() * 17);
    const g = gridColumns(width, n, gap);
    if (!g) continue;
    const label = `${width}/${n}/${gap}`;
    for (const e of edges(g)) { assert.equal(e % 4, 0, label); assert.equal(snap4(e), e, label); }
    assert.ok(Math.max(...g.w) - Math.min(...g.w) <= 4, `${label}: ${g.w}`);
    const gs = gutters(g);
    assert.ok(gs.every(v => v >= gap), 'a gutter is never narrower than declared');
    assert.ok(Math.max(...gs) - Math.min(...gs) === 0, `${label}: gutters ${gs}`); // without centerGutter all gutters are equal
    assert.ok(g.x[n - 1]! + g.w[n - 1]! <= width && width - (g.x[n - 1]! + g.w[n - 1]!) < 4 + 1e-6, `${label}: at most one step unused at the right`);
    assert.deepEqual(gridColumns(width, n, gap), g);
  }
});

test('a row that already divides on the grid is unchanged', () => {
  // 412 wide, gap 12, two columns: 200 + 12 + 200 is what the plain split gives
  assert.deepEqual(geo(kids(2), {gap: 12}, 412), {widths: [200, 200], xOffsets: [0, 212]});
});

test('rows with the same cols share edges: every span lands on the columns it covers (3 rows)', () => {
  const rows = [[6, 6], [3, 3, 3, 3], [4, 8], [2, 2, 2, 2, 2, 2]].map(spans => geo(spans.map(span => ({span})), {cols: 12}));
  const left = (r: ReturnType<typeof geo>, i: number) => r.xOffsets[i], rightOf = (r: ReturnType<typeof geo>, i: number) => r.xOffsets[i]! + r.widths[i]!;
  assert.equal(left(rows[0]!, 1), left(rows[1]!, 2));
  assert.equal(rightOf(rows[0]!, 0), rightOf(rows[1]!, 1));
  assert.equal(left(rows[2]!, 1), left(rows[3]!, 2), 'a 4 | 8 split starts where the third 2-wide column starts');
  assert.equal(rightOf(rows[0]!, 1), rightOf(rows[3]!, 5));
  assert.equal(rows[0]!.widths[0], rows[0]!.widths[1]);
});

test('unequal flex: rounding does not pile up on the last child', () => {
  for (const flex of [[3, 1, 1, 1, 1, 1, 1, 1], [1, 2, 1, 2, 1, 2, 1], [2, 1, 1, 1, 1, 1, 1, 1, 1, 1]]) {
    const r = geo(flex.map(f => ({flex: f})));
    for (const [i, x] of r.xOffsets.entries()) { assert.equal(x % 4, 0); assert.equal((x + r.widths[i]!) % 4, 0); }
    // children with the same flex differ by at most one step, whichever end they are at
    for (const f of new Set(flex)) {
      const ws = r.widths.filter((_, i) => flex[i] === f);
      assert.ok(Math.max(...ws) - Math.min(...ws) <= 4, `flex ${f} of ${flex}: ${ws}`);
    }
  }
});

test('quadrant: the columns are equal (a step apart at most) and the gutters even', async () => {
  const q = quadrant({x: {title: 'X', low: '低', high: '高'}, y: {title: 'Y', low: '低', high: '高'}, grid: [3, 3]} as never);
  const r = await renderDiagram(diagram({theme: 'blue', title: 'q'}).add(q), {name: 'x.svg', budget: 'cacheOnly'});
  assert.deepEqual(r.verdict.findings.filter(f => f.rule === 'layout-gutter-uneven' || f.rule === 'layout-sibling-size'), []);
  const cells = (r.laidOut.laidOut.find(b => b.type === 'quadrant') as LaidOutQuadrant).cells;
  const ws = cells.map(c => snap4(c.x + c.w) - snap4(c.x));
  assert.ok(Math.max(...ws) - Math.min(...ws) <= 4, `${ws}`);
  for (const c of cells) assert.equal(snap4(c.x), c.x, 'a cell starts on the grid');
  const xs = [...new Set(cells.map(c => c.x))].sort((a, b) => a - b);
  const gs = xs.slice(1).map((x, k) => x - xs[k]! - cells.find(c => c.x === xs[k])!.w);
  assert.equal(Math.max(...gs), Math.min(...gs));
});

// ---- ADR 0014 U2: a group stretched by its row hands the room to its content (relative checks only: no font-dependent heights) ----
const four = ['a', 'b', 'c', 'd'].map(id => box({title: id, id}));
const laid = async (r: Band) => (await renderDiagram(diagram({theme: 'blue', title: 't'}).add(r), {name: 'x.svg', budget: 'cacheOnly'})).laidOut.laidOut;
type Laid = Awaited<ReturnType<typeof laid>>;
const frames = (l: Laid) => l.filter(b => b.type === 'group') as LaidOutGroup[];
const boxOf = (l: Laid, id: string) => l.find(b => b.type === 'box' && b.id === id) as LaidOutBox;
const pair = (right: ReturnType<typeof group>) => row([group(four, {title: 'L'}), right], {cols: [6, 6]});

test('groupFillPlan: gaps grow by 16 at most (on the grid), the rest is split above and below', () => {
  assert.deepEqual(groupFillPlan(1, 100), {gap: 0, top: 48});
  assert.deepEqual(groupFillPlan(4, 60), {gap: 16, top: 4});
  assert.deepEqual(groupFillPlan(4, 300), {gap: 16, top: 124});
  assert.deepEqual(groupFillPlan(3, 24), {gap: 12, top: 0});
});

test('group in a row: the shorter group centres its box in the room; frames and titles line up', async () => {
  const l = await laid(pair(group([box({title: 'only', id: 'o'})], {title: 'R'})));
  const [g1, g2] = frames(l);
  assert.equal(g1!.h, g2!.h);
  const titleY = new Set(l.filter(b => b.type === 'caption').map(b => (b as unknown as {y: number}).y));
  assert.equal(titleY.size, 1, 'the two titles sit at the same y');
  const o = boxOf(l, 'o'), top = o.y - boxOf(l, 'a').y, below = g2!.y + g2!.h - 16 - (o.y + o.h);
  assert.ok(top > 0, 'the box moved down from the top');
  assert.ok(Math.abs(top - below) <= 8, `room above ${top} and below ${below} are about the same`);
});

test("group({valign: 'top'}) keeps the content at the top", async () => {
  const l = await laid(pair(group([box({title: 'only', id: 'o'})], {title: 'R', valign: 'top'})));
  assert.equal(boxOf(l, 'o').y, boxOf(l, 'a').y);
});

test("group({valign: 'stretch'}): a single box fills the room", async () => {
  const l = await laid(pair(group([box({title: 'only', id: 'o'})], {title: 'R', valign: 'stretch'})));
  const [, g2] = frames(l), o = boxOf(l, 'o');
  assert.equal(o.y, boxOf(l, 'a').y);
  assert.equal(snap4(o.y) + snap4(o.h), snap4(g2!.y) + snap4(g2!.h) - 16, 'the box, as drawn, ends one pad above the frame bottom (laid-out tops sit on the grid now, so compare the drawn edges)');
});

test('no room (equal groups): nothing moves', async () => {
  const l = await laid(row([group([box({title: 'x', id: 'q'})], {title: 'L'}), group([box({title: 'y', id: 'o'})], {title: 'R'})], {cols: [6, 6]}));
  assert.equal(boxOf(l, 'q').y, boxOf(l, 'o').y);
});

test('several boxes: the gaps open up before the rest is split, and every box stays inside the frame', async () => {
  const l = await laid(row([group(four, {title: 'L'}), group([box({title: 'p', id: 'p'}), box({title: 'q', id: 'q'})], {title: 'R'})], {cols: [6, 6]}));
  const [, g2] = frames(l), p = boxOf(l, 'p'), q = boxOf(l, 'q');
  const gapPQ = q.y - (p.y + p.h), gapAB = boxOf(l, 'b').y - (boxOf(l, 'a').y + boxOf(l, 'a').h);
  assert.ok(gapPQ >= gapAB && gapPQ <= gapAB + 16, `gap ${gapAB} grew to ${gapPQ}`);
  assert.ok(p.y >= g2!.y && q.y + q.h <= g2!.y + g2!.h);
});

test('nested groups and a group alone in a row stay inside their frame', async () => {
  const inner = group([box({title: 'in', id: 'i'})], {title: 'inner'});
  const l = await laid(row([group([inner, box({title: 'x', id: 'x'})], {title: 'L'}), group(four.map(b => ({...b, id: `${b.id}2`})), {title: 'R'})], {cols: [6, 6]}));
  const [outer] = frames(l);
  for (const id of ['i', 'x']) { const b = boxOf(l, id); assert.ok(b.y >= outer!.y && b.y + b.h <= outer!.y + outer!.h, id); }
  const alone = await laid(row([group([box({title: 'solo', id: 's'})], {title: 'only'})], {}));
  assert.equal(frames(alone).length, 1);
});
