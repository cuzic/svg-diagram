// node --test test/   — ADR 0014 U1: column edges are decided once per (width, columns, gap) on the 4px grid and shared by every row.
import test from 'node:test';
import assert from 'node:assert/strict';
import {gridColumns, rowChildGeometry} from '../lib/layout-util.ts';
import {box, diagram, group, row, quadrant, checkDiagram, renderDiagram} from '../lib/dsl.ts';

const kids = (n: number) => Array.from({length: n}, () => ({}));
const edges = (g: {x: number[]; w: number[]}) => g.x.flatMap((x, i) => [x, x + g.w[i]]);

test('two equal halves of 900 with gap 16 are 440 + 20 + 440', () => {
  const g = gridColumns(900, 2, 16)!;
  assert.deepEqual(g.w, [440, 440]);
  assert.deepEqual(g.x, [0, 460]);
  const r = rowChildGeometry({cols: undefined, gap: 16, justify: 'stretch', children: kids(2)}, 900);
  assert.deepEqual(r.widths, [440, 440]);
});

test('cols [6, 6]: the two frames are equal (no layout-sibling-size) and the group title sits on the box column', async () => {
  const d = diagram({theme: 'blue', title: 't'}).add(row([group([box({title: 'a'})], {title: 'L'}), group([box({title: 'b'})], {title: 'R'})], {cols: [6, 6]}));
  const r = await renderDiagram(d, {name: 'x.svg', budget: 'cacheOnly'});
  assert.deepEqual(r.verdict.findings.filter(f => f.rule.startsWith('layout-')), []);
  const xs = [...r.svg.matchAll(/<rect x="([\d.]+)" y="[\d.]+" width="([\d.]+)"/g)].map(m => [Number(m[1]), Number(m[2])]);
  for (const [x, w] of xs) { assert.equal(x % 4, 0); assert.equal((x + w) % 4, 0); }
});

test('property: edges on the grid, widths within one step, equal gutters, deterministic', () => {
  let seed = 12345;
  const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  for (let i = 0; i < 400; i++) {
    const width = 4 * Math.round(50 + rnd() * 175), n = 2 + Math.floor(rnd() * 11), gap = 8 + Math.floor(rnd() * 17);
    const g = gridColumns(width, n, gap);
    if (!g) continue;
    for (const e of edges(g)) assert.equal(e % 4, 0, `${width}/${n}/${gap}`);
    const lo = Math.min(...g.w), hi = Math.max(...g.w);
    assert.ok(hi - lo <= 4, `${width}/${n}/${gap}: ${g.w}`);
    const gaps = g.x.slice(1).map((x, k) => x - g.x[k] - g.w[k]);
    assert.ok(gaps.every(v => v >= gap), 'a gutter is never narrower than declared');
    assert.ok(Math.max(...gaps) - Math.min(...gaps) <= 4);
    assert.equal(g.x[n - 1] + g.w[n - 1], width);
    assert.deepEqual(gridColumns(width, n, gap), g);
  }
});

test('rows with the same cols share edges: a span-2 box sits over two span-1 boxes', () => {
  const geo = (kidsSpec: {span?: number}[]) => rowChildGeometry({cols: 12, gap: 16, justify: 'stretch', children: kidsSpec}, 900);
  const a = geo([{span: 6}, {span: 6}]), b = geo([{span: 3}, {span: 3}, {span: 3}, {span: 3}]);
  assert.equal(a.xOffsets[0], b.xOffsets[0]);
  assert.equal(a.xOffsets[1], b.xOffsets[2]);
  assert.equal(a.xOffsets[1] + a.widths[1], b.xOffsets[3] + b.widths[3]);
  assert.equal(a.widths[0], a.widths[1]);
});

test('quadrant: the columns are equal and the gutters even (no 8/4 alternation)', async () => {
  const q = quadrant({x: {title: 'X', low: '低', high: '高'}, y: {title: 'Y', low: '低', high: '高'}, grid: [3, 3]} as never);
  const r = await checkDiagram(diagram({theme: 'blue', title: 'q'}).add(q));
  assert.deepEqual(r.verdict.findings.filter(f => f.rule === 'layout-gutter-uneven'), []);
});
