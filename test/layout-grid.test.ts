// node --test test/   — ADR 0014 U1: column edges are decided once per (width, columns, gap) on the 4px grid and shared by every row.
import test from 'node:test';
import assert from 'node:assert/strict';
import {gridColumns, rowChildGeometry} from '../lib/layout-util.ts';
import {box, diagram, group, row, quadrant, renderDiagram} from '../lib/dsl.ts';
import {snap4} from '../lib/emit-common.ts';
import type {LaidOutQuadrant} from '../lib/quadrant.ts';

const kids = (n: number) => Array.from({length: n}, () => ({}));
const edges = (g: {x: number[]; w: number[]}) => g.x.flatMap((x, i) => [x, x + g.w[i]]);
const gutters = (g: {x: number[]; w: number[]}) => g.x.slice(1).map((x, k) => x - g.x[k] - g.w[k]);
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
  assert.equal(rects[0].w, rects[1].w);
  for (const f of rects) { assert.equal(f.x % 4, 0); assert.equal((f.x + f.w) % 4, 0); }
  const title = (t: string) => Number(new RegExp(`<text x="([\\d.]+)"[^>]*>${t}</text>`).exec(r.svg)?.[1]);
  const boxX = [...r.svg.matchAll(/<rect x="([\d.]+)" y="[\d.]+" width="[\d.]+" height="[\d.]+" rx="8" fill="#(?:fff|ffffff)"/g)].map(m => Number(m[1])).filter(x => x !== 0);
  assert.equal(title('L') - rects[0].x, title('R') - rects[1].x, 'the same inset in the left and the right group (no 494 / 496)');
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
    assert.ok(g.x[n - 1] + g.w[n - 1] <= width && width - (g.x[n - 1] + g.w[n - 1]) < 4 + 1e-6, `${label}: at most one step unused at the right`);
    assert.deepEqual(gridColumns(width, n, gap), g);
  }
});

test('a row that already divides on the grid is unchanged', () => {
  // 412 wide, gap 12, two columns: 200 + 12 + 200 is what the plain split gives
  assert.deepEqual(geo(kids(2), {gap: 12}, 412), {widths: [200, 200], xOffsets: [0, 212]});
});

test('rows with the same cols share edges: every span lands on the columns it covers (3 rows)', () => {
  const rows = [[6, 6], [3, 3, 3, 3], [4, 8], [2, 2, 2, 2, 2, 2]].map(spans => geo(spans.map(span => ({span})), {cols: 12}));
  const left = (r: ReturnType<typeof geo>, i: number) => r.xOffsets[i], rightOf = (r: ReturnType<typeof geo>, i: number) => r.xOffsets[i] + r.widths[i];
  assert.equal(left(rows[0], 1), left(rows[1], 2));
  assert.equal(rightOf(rows[0], 0), rightOf(rows[1], 1));
  assert.equal(left(rows[2], 1), left(rows[3], 2), 'a 4 | 8 split starts where the third 2-wide column starts');
  assert.equal(rightOf(rows[0], 1), rightOf(rows[3], 5));
  assert.equal(rows[0].widths[0], rows[0].widths[1]);
});

test('unequal flex: rounding does not pile up on the last child', () => {
  for (const flex of [[3, 1, 1, 1, 1, 1, 1, 1], [1, 2, 1, 2, 1, 2, 1], [2, 1, 1, 1, 1, 1, 1, 1, 1, 1]]) {
    const r = geo(flex.map(f => ({flex: f})));
    for (const [i, x] of r.xOffsets.entries()) { assert.equal(x % 4, 0); assert.equal((x + r.widths[i]) % 4, 0); }
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
  const gs = xs.slice(1).map((x, k) => x - xs[k] - cells.find(c => c.x === xs[k])!.w);
  assert.equal(Math.max(...gs), Math.min(...gs));
});
