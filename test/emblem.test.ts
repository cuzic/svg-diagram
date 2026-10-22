// emblem(): a word or two inside a circle / square / triangle / diamond / hexagon, as one flow-shape band.
import test from 'node:test';
import './helpers/strict-width.ts';
import assert from 'node:assert/strict';
import {diagram, emblem, renderDiagram, closeMeasurer, connect, row, box} from '../lib/dsl.ts';
import {emblemBand, flowShapeIds, layoutFlowShape} from '../lib/flow-shapes.ts';
import {ROLES} from '../lib/tokens.ts';
import type {LaidOutFlowShape} from '../lib/flow-shapes.ts';
import type {Rect} from '../lib/types/core.ts';

test.after(() => closeMeasurer());

const roughWidth = (atom: string, size: number) => Array.from(atom).length * size * .58;
const figure = (band: ReturnType<typeof emblemBand>, width = 892): LaidOutFlowShape => layoutFlowShape(band, 24, 24, width, roughWidth, ROLES, 'phrase');
const inside = (t: Rect, f: Rect) => t.x >= f.x - .5 && t.y >= f.y - .5 && t.x + t.w <= f.x + f.w + .5 && t.y + t.h <= f.y + f.h + .5;
const KINDS = ['circle', 'square', 'triangle', 'diamond', 'hexagon'] as const;

test('every kind holds its label inside the shape it is drawn in', () => {
  for (const kind of KINDS) {
    const f = figure(emblemBand([{id: 'a', label: '重要な注意', sub: '期限厳守'}, {id: 'b', label: '確認'}], {kind}));
    assert.equal(f.anchors.length, 2, kind);
    for (const t of f.labelBoxes) assert.ok(f.anchors.some(a => inside(t, a)), `${kind}: "${t.label}" is outside every shape`);
  }
});

test('the shapes of a band share one size, and grow until the longest label fits', () => {
  const short = figure(emblemBand([{id: 'a', label: '一'}, {id: 'b', label: '二'}]));
  const long = figure(emblemBand([{id: 'a', label: '一'}, {id: 'b', label: 'あ'.repeat(30)}]));
  assert.equal(short.anchors[0]!.w, short.anchors[1]!.w);
  assert.equal(long.anchors[0]!.w, long.anchors[1]!.w);
  assert.ok(long.anchors[0]!.w > short.anchors[0]!.w, 'a longer label makes the shapes bigger');
  assert.equal(short.anchors[0]!.w, 96, 'the least size by default');
  assert.equal(figure(emblemBand([{label: '一', id: 'a'}], {size: 90})).anchors[0]!.w, 96, 'size is a least width: it rounds up to the 8px step, never down');
});

test('size is the least width; shapes wrap to the next row when the width runs out', () => {
  const f = figure(emblemBand(Array.from({length: 5}, (_, i) => ({id: `n${i}`, label: `${i}`})), {size: 200, gap: 20}), 500);
  assert.equal(f.anchors[0]!.w, 200);
  const ys = new Set(f.anchors.map(a => a.y));
  assert.equal(ys.size, 3, 'two per row: 200+20+200 <= 500 < 3 shapes');
  for (const a of f.anchors) assert.ok(a.x >= 24 && a.x + a.w <= 24 + 500 + 1, 'inside the width');
});

test('a label that cannot fit up to the largest size throws, naming the label and the way out', () => {
  assert.throws(() => figure(emblemBand([{label: 'あ'.repeat(200)}], {kind: 'triangle'})), /"あああ.*does not fit in a triangle.*sub.*square/s);
  assert.throws(() => figure(emblemBand([{label: 'あ'.repeat(600)}], {kind: 'square'})), (e: Error) => /does not fit in a square/.test(e.message) && !/use kind 'square'|or use kind/.test(e.message), 'a square is not told to use a square');
  assert.throws(() => figure(emblemBand([{label: '短い', sub: 'あ'.repeat(800)}])), /"短い" \/ "あああ/, 'a sub that does not fit is named too');
});

test('constructor checks: kind, tone, size, gap, empty label, duplicate id', () => {
  assert.throws(() => emblemBand([{label: 'a', kind: 'star' as never}]), /unknown kind "star"/);
  assert.throws(() => emblemBand([{label: 'a', tone: 'pink' as never}]), /unknown tone "pink"/);
  assert.throws(() => emblemBand([{label: 'a'}], {size: 10}), /size must be/);
  assert.throws(() => emblemBand([{label: 'a'}], {gap: -1}), /gap must be/);
  assert.throws(() => emblemBand([{label: ' '}]), /non-empty label/);
  assert.throws(() => emblemBand([{label: 'a', id: 'x'}, {label: 'b', id: 'x'}]), /duplicate id "x"/);
  assert.throws(() => emblemBand([]), /at least one/);
});

test('emblem(label, opts) is one shape whose id is its anchor; the array form takes item ids', () => {
  const one = emblem('重要', {kind: 'triangle', tone: 'danger', id: 'warn'});
  assert.equal(one.type, 'emblem');
  assert.deepEqual(flowShapeIds(one), ['warn']);
  assert.equal(one.items[0]!.kind, 'triangle');
  const many = emblem([{label: 'A', id: 'a'}, {label: 'B'}], {kind: 'hexagon'});
  assert.deepEqual(flowShapeIds(many), ['a']);
  assert.equal(many.kind, 'hexagon');
});

test('a diagram with emblems builds clean, draws each kind once, and connect() reaches an emblem', async () => {
  const d = diagram({theme: 'blue'}).add(
    emblem(KINDS.map((kind, i) => ({id: `e${i}`, label: kind === 'circle' ? '円' : kind === 'square' ? '四角' : kind === 'triangle' ? '三角' : kind === 'diamond' ? 'ひし形' : '六角形', kind})), {size: 112}),
    row([box({id: 'b', title: '説明'})]),
    connect('e2:bottom', 'b:top'),
  );
  const r = await renderDiagram(d, {name: 'emblem.svg', budget: 'cacheOnly'});
  assert.deepEqual(r.verdict.problems, []);
  assert.equal((r.svg.match(/<circle /g) ?? []).length, 1);
  assert.equal((r.svg.match(/<polygon /g) ?? []).length, 4);
  for (const t of ['円', '四角', '三角', 'ひし形', '六角形']) assert.match(r.svg, new RegExp(`>${t}<`));
});

// ---- review (Opus, PR #321) ----------------------------------------------------------------------------------------------------------

/** The drawn outline of the i-th shape: a polygon's points, or a circle as 'c'. */
const outlines = (f: LaidOutFlowShape) => f.primitives.map(p => p.k === 'polygon' ? p.points : p.k === 'circle' ? ({cx: p.cx, cy: p.cy, r: p.r}) : null);
/** Signed distance of a point inside a convex polygon (clockwise or not) to its nearest side: positive = inside. */
function insideBy(poly: [number, number][], q: [number, number]): number {
  let area = 0; poly.forEach((p, i) => { const n = poly[(i + 1) % poly.length]!; area += p[0] * n[1] - n[0] * p[1]; });
  const sign = Math.sign(area) || 1;
  return Math.min(...poly.map((p, i) => { const n = poly[(i + 1) % poly.length]!, len = Math.hypot(n[0] - p[0], n[1] - p[1]); return sign * ((n[0] - p[0]) * (q[1] - p[1]) - (n[1] - p[1]) * (q[0] - p[0])) / len; }));
}

test('every corner of every text box is inside the outline it is drawn in (by the stroke), for every kind, size and sub', () => {
  for (const kind of KINDS) for (const size of [64, 72, 96, 104, 120, 136, 200]) for (const [label, sub] of [['一', undefined], ['重要な注意', '期限厳守'], ['WWWW', 'MMMM'], ['確認する', undefined], ['あ'.repeat(6), 'い'.repeat(5)]] as const) {
    let f: LaidOutFlowShape;
    try { f = figure(emblemBand([{label, ...(sub ? {sub} : {})}], {kind, size})); } catch { continue; } // too long for the shape: it throws, which is tested above
    const o = outlines(f)[0]!;
    for (const t of f.labelBoxes) for (const q of [[t.x, t.y], [t.x + t.w, t.y], [t.x, t.y + t.h], [t.x + t.w, t.y + t.h]] as [number, number][]) {
      const margin = Array.isArray(o) ? insideBy(o, q) : (o as {r: number}).r - Math.hypot(q[0] - (o as {cx: number}).cx, q[1] - (o as {cy: number}).cy);
      assert.ok(margin >= 1, `${kind} size ${size} "${label}": a text corner is ${margin.toFixed(1)}px inside the outline`);
    }
  }
});

test('a hexagon and a triangle are symmetric about their centre line, on the 4px grid, at every size', () => {
  for (const kind of ['hexagon', 'triangle', 'diamond'] as const) for (let size = 64; size <= 320; size += 8) {
    const f = figure(emblemBand([{label: '一'}], {kind, size}), 892), pts = (outlines(f)[0] as [number, number][]);
    const xs = pts.map(p => p[0]), mid = (Math.min(...xs) + Math.max(...xs)) / 2;
    for (const [x, y] of pts) {
      assert.equal(x % 4, 0, `${kind} ${size}: x ${x} is off the grid`); assert.equal(y % 4, 0, `${kind} ${size}: y ${y} is off the grid`);
      assert.ok(pts.some(([x2, y2]) => y2 === y && Math.abs((x2 - mid) + (x - mid)) < 1e-9), `${kind} ${size}: (${x},${y}) has no mirror image`);
    }
  }
});

test('connect() meets the outline: a triangle ties to the middles of its slanted sides, a hexagon to its side vertices', () => {
  const tri = figure(emblemBand([{id: 't', label: '注意', kind: 'triangle'}], {size: 104})), a = tri.anchors[0]!, poly = outlines(tri)[0] as [number, number][];
  const [apex, br, bl] = poly as [[number, number], [number, number], [number, number]];
  assert.deepEqual([a.x + a.w / 2, a.y], apex, ':top is the apex');
  assert.deepEqual([a.x, a.y + a.h / 2], [(apex[0] + bl[0]) / 2, (apex[1] + bl[1]) / 2], ':left is the middle of the left side');
  assert.deepEqual([a.x + a.w, a.y + a.h / 2], [(apex[0] + br[0]) / 2, (apex[1] + br[1]) / 2], ':right is the middle of the right side');
  assert.equal(a.y + a.h, br[1], ':bottom is the base');
  const hex = figure(emblemBand([{id: 'h', label: '実行', kind: 'hexagon'}], {size: 104})), b = hex.anchors[0]!, hp = outlines(hex)[0] as [number, number][];
  assert.deepEqual([b.x, b.y + b.h / 2], hp[0], ':left is the left vertex');
  assert.deepEqual([b.x + b.w, b.y + b.h / 2], hp[3], ':right is the right vertex');
  assert.equal(b.y + b.h, hp[4]![1], ':bottom is the bottom edge');
});

// A width close to the real fonts': a full-width character is 1em, an ASCII one .58em (roughWidth counts every character as .58em, which
// makes a katakana word look 40% narrower than it is).
const realWidth = (atom: string, size: number) => [...atom].reduce((w, c) => w + (/[ -~]/.test(c) ? .58 : 1) * size, 0);
const figureReal = (band: ReturnType<typeof emblemBand>, width = 892): LaidOutFlowShape => layoutFlowShape(band, 24, 24, width, realWidth, ROLES, 'phrase');
const linesOf = (f: LaidOutFlowShape) => f.texts.map(t => t.text);

test('a katakana word stays whole: the shape grows for it (up to 240px), as keepWords does for boxes', () => {
  const small = figureReal(emblemBand([{label: 'エンジニア', id: 'a'}]));            // 5 chars = 70px: fits at the least size
  assert.deepEqual(linesOf(small), ['エンジニア']);
  const f = figureReal(emblemBand([{label: 'エンジニアリング', id: 'a'}]));            // 8 chars = 112px: needs .76 D >= 112
  assert.deepEqual(linesOf(f), ['エンジニアリング'], 'one line, the word is not cut');
  assert.ok(f.anchors[0]!.w > 96, 'the shape grew past the least size to keep it');
  const cut = figureReal(emblemBand([{label: 'コ'.repeat(30), kind: 'hexagon'}]));      // 420px: .68 * 240 = 163px, cannot be whole
  assert.ok(cut.texts.length > 1, 'a word too long for 240px is cut at the least size that fits, rather than throwing');
});

test('breaks at a space, a newline or ・ are not cut words, so they never make a shape grow', () => {
  const plain = figureReal(emblemBand([{label: '行きつけの店を決める'}]));          // no katakana / latin: the size it always was
  const phrase = figureReal(emblemBand([{label: 'Plan Do Check Act'}]));
  assert.ok(phrase.anchors.length === 0 && phrase.primitives.length === 1);
  const d = (f: LaidOutFlowShape) => (f.primitives[0] as {r: number}).r * 2;
  assert.ok(d(phrase) <= 120, `"Plan Do Check Act" wraps at its spaces in a small circle, not one long line (D=${d(phrase)})`);
  assert.ok(linesOf(phrase).length >= 2);
  assert.ok(d(plain) <= 160);
  const two = figureReal(emblemBand([{label: 'コンテキスト エンジニアリング'}]));       // two words: 6 and 8 chars
  assert.deepEqual(linesOf(two), ['コンテキスト', 'エンジニアリング'], 'wrapped at the space, both words whole');
  const dot = figureReal(emblemBand([{label: '営業・マーケティング'}]));
  assert.ok(d(dot) <= 160, `a break after ・ is not a cut word (D=${d(dot)})`);
});

test('a label that cannot be whole is let off, so it does not spoil the others; an explicit newline is not a cut', () => {
  const f = figureReal(emblemBand([{label: 'ア'.repeat(30)}, {label: 'インフラストラクチャ'}]));
  assert.ok(linesOf(f).includes('インフラストラクチャ'), 'the other word stays whole even though the first cannot');
  const g = figureReal(emblemBand([{label: 'ABC\nDEF'}, {label: 'インフラストラクチャ'}]));
  assert.ok(linesOf(g).includes('インフラストラクチャ'), 'a newline between ABC and DEF is not a cut word');
});

test('the obstacle of a triangle is its bounding box, so a line through its lower corner is stopped (its anchor leaves the corners out)', async () => {
  const d = diagram({theme: 'blue'}).add(
    row([box({id: 'a1', title: '1'}), box({id: 'a2', title: '2'}), box({id: 'a3', title: '3'}), box({id: 'a4', title: '4'})]),
    emblem([{label: '注意', kind: 'triangle', id: 't'}], {size: 320}),
    row([box({id: 'b1', title: '1'}), box({id: 'b2', title: '2'}), box({id: 'b3', title: '3'}), box({id: 'b4', title: '4'})]),
    connect('a2:bottom', 'b2:top'),
  );
  const r = await renderDiagram(d, {name: 'corner.svg', budget: 'cacheOnly'});
  assert.ok(r.verdict.problems.some(p => /path overlaps "t"/.test(p)), `the line runs through the triangle's corner: ${r.verdict.problems.join(' / ')}`);
});

test('a shape wider than the band throws, naming the way out', () => {
  assert.throws(() => figure(emblemBand([{label: '課題'}], {size: 200}), 120), /size 200 is wider than the band/);
  assert.throws(() => figure(emblemBand([{label: 'あ'.repeat(120)}]), 160), /up to 160px \(the width of the band\).*widen the band/s);
});

test('gap is rounded to the 4px grid, so the shapes are evenly spaced', () => {
  const f = figure(emblemBand([{id: 'a', label: '1'}, {id: 'b', label: '2'}, {id: 'c', label: '3'}], {gap: 6}));
  const [a, b, c] = f.anchors as unknown as [Rect, Rect, Rect];
  assert.equal(b.x - (a.x + a.w), c.x - (b.x + b.w));
});

test('emblem(label, {id, scope}): the handle names the item as <scope>.<id>, as the anchor is registered', () => {
  const one = emblem('上', {id: 'p', scope: 's1'}) as unknown as {bottom: string};
  assert.equal(one.bottom, 's1.p:bottom');
  const bare = emblem('上', {id: 'p'}) as unknown as {bottom: string};
  assert.equal(bare.bottom, 'p:bottom');
});
