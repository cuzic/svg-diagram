// emblem(): a word or two inside a circle / square / triangle / diamond / hexagon, as one flow-shape band.
import test from 'node:test';
import './helpers/strict-width.ts';
import assert from 'node:assert/strict';
import {diagram, emblem, renderDiagram, checkDiagram, closeMeasurer, connect, row, box} from '../lib/dsl.ts';
import {emblemBand, flowShapeIds, layoutFlowShape} from '../lib/flow-shapes.ts';
import {EMBLEM_FLEX, EMBLEM_SHAPES, emblemClearance, emblemHeight, emblemMaxHeight, emblemOutline} from '../lib/emblem-shapes.ts';
import {flattenPath} from '../lib/svg-geom.ts';
import {ROLES} from '../lib/tokens.ts';
import type {LaidOutFlowShape} from '../lib/flow-shapes.ts';
import type {Rect} from '../lib/types/core.ts';

test.after(() => closeMeasurer());

const roughWidth = (atom: string, size: number) => Array.from(atom).length * size * .58;
const figure = (band: ReturnType<typeof emblemBand>, width = 892): LaidOutFlowShape => layoutFlowShape(band, 24, 24, width, roughWidth, ROLES, 'phrase');
const inside = (t: Rect, f: Rect) => t.x >= f.x - .5 && t.y >= f.y - .5 && t.x + t.w <= f.x + f.w + .5 && t.y + t.h <= f.y + f.h + .5;
const SHAPES = EMBLEM_SHAPES;

test('every shape holds its label inside the shape it is drawn in', () => {
  for (const shape of SHAPES) {
    const f = figure(emblemBand([{id: 'a', label: '重要な注意', sub: '期限厳守'}, {id: 'b', label: '確認'}], {shape}));
    assert.equal(f.anchors.length, 2, shape);
    for (const t of f.labelBoxes) assert.ok(f.anchors.some(a => inside(t, a)), `${shape}: "${t.label}" is outside every shape`);
  }
});

test('the shapes of a band share one size, and grow until the longest label fits', () => {
  const short = figure(emblemBand([{id: 'a', label: '一'}, {id: 'b', label: '二'}]));
  const long = figure(emblemBand([{id: 'a', label: '一'}, {id: 'b', label: 'あ'.repeat(30)}]));
  assert.equal(short.anchors[0]!.w, short.anchors[1]!.w);
  assert.equal(long.anchors[0]!.w, long.anchors[1]!.w);
  assert.ok(long.anchors[0]!.w > short.anchors[0]!.w, 'a longer label makes the shapes bigger');
  assert.equal(short.anchors[0]!.w, 96, 'the least size by default');
  assert.equal(figure(emblemBand([{label: '一', id: 'a'}], {minSize: 90})).anchors[0]!.w, 96, 'size is a least width: it rounds up to the 8px step, never down');
});

test('size is the least width; shapes wrap to the next row when the width runs out', () => {
  const f = figure(emblemBand(Array.from({length: 5}, (_, i) => ({id: `n${i}`, label: `${i}`})), {minSize: 200, gap: 20}), 500);
  assert.equal(f.anchors[0]!.w, 200);
  const ys = new Set(f.anchors.map(a => a.y));
  assert.equal(ys.size, 3, 'two per row: 200+20+200 <= 500 < 3 shapes');
  for (const a of f.anchors) assert.ok(a.x >= 24 && a.x + a.w <= 24 + 500 + 1, 'inside the width');
});

test('a label that cannot fit up to the largest size throws, naming the label and the way out', () => {
  assert.throws(() => figure(emblemBand([{label: 'あ'.repeat(200)}], {shape: 'triangle'})), /"あああ.*does not fit in a triangle.*sub.*square/s);
  assert.throws(() => figure(emblemBand([{label: 'あ'.repeat(600)}], {shape: 'square'})), (e: Error) => /does not fit in a square/.test(e.message) && !/use shape 'square'|or use shape/.test(e.message), 'a square is not told to use a square');
  assert.throws(() => figure(emblemBand([{label: '短い', sub: 'あ'.repeat(800)}])), /"短い" \/ "あああ/, 'a sub that does not fit is named too');
});

test('the old names `kind` and `size` are refused, not ignored (an ignored `kind` would silently draw circles)', () => {
  assert.throws(() => emblemBand([{label: 'a'}], {kind: 'hexagon'} as never), /`kind` is now `shape`/);
  assert.throws(() => emblemBand([{label: 'a', kind: 'hexagon'} as never]), /`kind` is now `shape` \(item 1\)/);
  assert.throws(() => emblemBand([{label: 'a'}], {size: 120} as never), /`size` is now `minSize`/);
});

test('constructor checks: shape, tone, minSize, gap, empty label, duplicate id', () => {
  assert.throws(() => emblemBand([{label: 'a', shape: 'star' as never}]), /unknown shape "star"/);
  assert.throws(() => emblemBand([{label: 'a', tone: 'pink' as never}]), /unknown tone "pink"/);
  assert.throws(() => emblemBand([{label: 'a'}], {minSize: 10}), /minSize must be/);
  assert.throws(() => emblemBand([{label: 'a'}], {gap: -1}), /gap must be/);
  assert.throws(() => emblemBand([{label: ' '}]), /non-empty label/);
  assert.throws(() => emblemBand([{label: 'a', id: 'x'}, {label: 'b', id: 'x'}]), /duplicate id "x"/);
  assert.throws(() => emblemBand([]), /at least one/);
});

test('emblem(label, opts) is one shape whose id is its anchor; the array form takes item ids', () => {
  const one = emblem('重要', {shape: 'triangle', tone: 'danger', id: 'warn'});
  assert.equal(one.type, 'emblem');
  assert.deepEqual(flowShapeIds(one), ['warn']);
  assert.equal(one.items[0]!.shape, 'triangle');
  const many = emblem([{label: 'A', id: 'a'}, {label: 'B'}], {shape: 'hexagon'});
  assert.deepEqual(flowShapeIds(many), ['a']);
  assert.equal(many.shape, 'hexagon');
});

const WORDS: Record<string, string> = {circle: '円', square: '四角', triangle: '三角', diamond: 'ひし形', hexagon: '六角形', trapezoid: '台形', 'inverted-trapezoid': '逆台形', parallelogram: 'データ', pentagon: '五角形', pill: '端子', rounded: '角丸', document: '書類', cylinder: '円柱'};

test('a diagram with every shape builds clean and draws each one once', async () => {
  const d = diagram({theme: 'blue'}).add(emblem(SHAPES.map((shape, i) => ({id: `e${i}`, label: WORDS[shape]!, shape})), {minSize: 112}));
  const r = await renderDiagram(d, {name: 'emblem.svg', budget: 'cacheOnly'});
  assert.deepEqual(r.verdict.problems, []);
  assert.equal((r.svg.match(/<circle /g) ?? []).length, 1, 'the circle');
  assert.equal((r.svg.match(/<polygon /g) ?? []).length, 8, 'square, triangle, diamond, hexagon, trapezoid, inverted trapezoid, parallelogram, pentagon');
  assert.equal((r.svg.match(/<path [^>]*fill="#/g) ?? []).length, 4, 'pill, rounded, document, cylinder: filled paths');
  for (const t of Object.values(WORDS)) assert.match(r.svg, new RegExp(`>${t}<`));
});

test('connect() reaches every shape: a line from its :bottom to a box below builds clean', async () => {
  for (const shape of SHAPES) {
    const d = diagram({theme: 'blue'}).add(emblem([{id: 'a', label: WORDS[shape]!, shape}]), row([box({id: 'b', title: '説明'})]), connect('a:bottom', 'b:top'));
    const r = await renderDiagram(d, {name: 'emblem.svg', budget: 'cacheOnly'});
    assert.deepEqual(r.verdict.problems, [], shape);
  }
});

// ---- review (Opus, PR #321) ----------------------------------------------------------------------------------------------------------

/** The drawn outline of the i-th shape: a polygon's points. */
const outlines = (f: LaidOutFlowShape) => f.primitives.map(p => p.k === 'polygon' ? p.points : null);

test('every corner of every text box is inside the outline it is drawn in (by the stroke), for every shape, size and sub', () => {
  for (const shape of SHAPES) for (const size of [64, 72, 96, 104, 120, 136, 200]) for (const [label, sub] of [['一', undefined], ['重要な注意', '期限厳守'], ['WWWW', 'MMMM'], ['確認する', undefined], ['あ'.repeat(6), 'い'.repeat(5)]] as const) {
    let f: LaidOutFlowShape;
    try { f = figure(emblemBand([{id: 'a', label, ...(sub ? {sub} : {})}], {shape, minSize: size})); } catch { continue; } // too long for the shape: it throws, which is tested above
    const b = f.bounds![0]!;
    for (const t of f.labelBoxes) for (const q of [[t.x, t.y], [t.x + t.w, t.y], [t.x, t.y + t.h], [t.x + t.w, t.y + t.h]] as [number, number][]) {
      const margin = emblemClearance(shape, b.x, b.y, b.w, q, b.h);
      assert.ok(margin >= 1, `${shape} size ${size} "${label}": a text corner is ${margin.toFixed(1)}px inside the outline`);
    }
  }
});

test("the text rectangle's own corners stay inside every shape, at every size", () => {
  for (const shape of SHAPES) for (let size = 64; size <= 320; size += 8) {
    const f = figure(emblemBand([{id: 'a', label: '一'}], {shape, minSize: size}), 892), a = f.bounds![0]!, d = a.w;
    // the text rectangle is EMBLEM_TEXT[shape] of D, centred on the label's centre: take the label box's centre
    const t = f.labelBoxes[0]!, cx = t.x + t.w / 2, cy = t.y + t.h / 2;
    assert.ok(emblemClearance(shape, a.x, a.y, d, [cx, cy], a.h) > d * .1, `${shape} ${size}: the centre of the text is deep inside`);
  }
});

test('polygon shapes are symmetric about their centre line (a parallelogram about its centre), with every vertex on the 4px grid, at every size', () => {
  for (const shape of ['hexagon', 'triangle', 'diamond', 'trapezoid', 'inverted-trapezoid', 'pentagon', 'parallelogram'] as const) for (let size = 64; size <= 320; size += 8) {
    const f = figure(emblemBand([{label: '一'}], {shape, minSize: size}), 892), pts = (outlines(f)[0] as [number, number][]);
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]), mx = (Math.min(...xs) + Math.max(...xs)) / 2, my = (Math.min(...ys) + Math.max(...ys)) / 2;
    for (const [x, y] of pts) {
      assert.equal(x % 4, 0, `${shape} ${size}: x ${x} is off the grid`); assert.equal(y % 4, 0, `${shape} ${size}: y ${y} is off the grid`);
      const mirror = shape === 'parallelogram' ? pts.some(([x2, y2]) => Math.abs((x2 - mx) + (x - mx)) < 1e-9 && Math.abs((y2 - my) + (y - my)) < 1e-9) : pts.some(([x2, y2]) => y2 === y && Math.abs((x2 - mx) + (x - mx)) < 1e-9);
      assert.ok(mirror, `${shape} ${size}: (${x},${y}) has no mirror image`);
    }
  }
});

test(':top / :bottom / :left / :right of every shape land on its outline (within a pixel), at several sizes', () => {
  for (const shape of SHAPES) for (const size of [64, 96, 120, 152, 200, 320]) {
    const f = figure(emblemBand([{id: 'a', label: '一', shape}], {minSize: size}), 892), a = f.anchors[0]!, b = f.bounds![0]!;
    const points: [string, [number, number]][] = [['top', [a.x + a.w / 2, a.y]], ['bottom', [a.x + a.w / 2, a.y + a.h]], ['left', [a.x, a.y + a.h / 2]], ['right', [a.x + a.w, a.y + a.h / 2]]];
    for (const [name, q] of points) assert.ok(Math.abs(emblemClearance(shape, b.x, b.y, b.w, q, b.h)) <= 1, `${shape} ${size}: :${name} is ${emblemClearance(shape, b.x, b.y, b.w, q, b.h).toFixed(1)}px from the outline`);
  }
});

test('connect() meets the outline: a triangle ties to the middles of its slanted sides, a hexagon to its side vertices', () => {
  const tri = figure(emblemBand([{id: 't', label: '注意', shape: 'triangle'}], {minSize: 104})), a = tri.anchors[0]!, poly = outlines(tri)[0] as [number, number][];
  const [apex, br, bl] = poly as [[number, number], [number, number], [number, number]];
  assert.deepEqual([a.x + a.w / 2, a.y], apex, ':top is the apex');
  assert.deepEqual([a.x, a.y + a.h / 2], [(apex[0] + bl[0]) / 2, (apex[1] + bl[1]) / 2], ':left is the middle of the left side');
  assert.deepEqual([a.x + a.w, a.y + a.h / 2], [(apex[0] + br[0]) / 2, (apex[1] + br[1]) / 2], ':right is the middle of the right side');
  assert.equal(a.y + a.h, br[1], ':bottom is the base');
  const hex = figure(emblemBand([{id: 'h', label: '実行', shape: 'hexagon'}], {minSize: 104})), b = hex.anchors[0]!, hp = outlines(hex)[0] as [number, number][];
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
  const cut = figureReal(emblemBand([{label: 'コ'.repeat(30), shape: 'hexagon'}]));      // 420px: .68 * 240 = 163px, cannot be whole
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

test('half-width katakana and full-width alphanumerics are words too (the shape grows to keep them whole)', () => {
  const half = figureReal(emblemBand([{label: 'ｱｲｳｴｵｶｷｸｹｺ'}]));          // 10 chars = 140px
  assert.deepEqual(linesOf(half), ['ｱｲｳｴｵｶｷｸｹｺ']);
  const full = figureReal(emblemBand([{label: 'ＡＢＣＤＥＦＧＨ'}]));
  assert.deepEqual(linesOf(full), ['ＡＢＣＤＥＦＧＨ']);
});

test('a label is let off only when it is whole at no size up to 240px (a cut can fall on a ・ at one size and not at the next)', () => {
  // whole at some D in the range, though cut at the least size: the shape grows until it is whole
  const f = figureReal(emblemBand([{label: 'コタスケカタヌネウ・クキスソク あい書いうお'}]));
  const cut = linesOf(f).some((l, i, all) => i > 0 && /[ァ-ヺー]/.test(all[i - 1]!.at(-1)!) && /[ァ-ヺー]/.test(l[0]!) );
  assert.equal(cut, false, `no katakana word is cut: ${linesOf(f).join(' | ')}`);
});

test('the obstacle of a triangle is its bounding box, so a line through its lower corner is stopped (its anchor leaves the corners out)', async () => {
  const d = diagram({theme: 'blue'}).add(
    row([box({id: 'a1', title: '1'}), box({id: 'a2', title: '2'}), box({id: 'a3', title: '3'}), box({id: 'a4', title: '4'})]),
    emblem([{label: '注意', shape: 'triangle', id: 't'}], {minSize: 320}),
    row([box({id: 'b1', title: '1'}), box({id: 'b2', title: '2'}), box({id: 'b3', title: '3'}), box({id: 'b4', title: '4'})]),
    connect('a2:bottom', 'b2:top'),
  );
  const r = await renderDiagram(d, {name: 'corner.svg', budget: 'cacheOnly'});
  assert.ok(r.verdict.problems.some(p => /path overlaps "t"/.test(p)), `the line runs through the triangle's corner: ${r.verdict.problems.join(' / ')}`);
});

test('a shape wider than the band throws, naming the way out', () => {
  assert.throws(() => figure(emblemBand([{label: '課題'}], {minSize: 200}), 120), /minSize 200 is wider than the band/);
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

// ---- tone ----------------------------------------------------------------------------------------------------------------------------

test("the label is written in the tone's own text colour, as a box does, so `accent` and `new` differ by more than a stroke", () => {
  const f = figure(emblemBand([{label: 'A', tone: 'accent'}, {label: 'B', tone: 'new'}, {label: 'C', tone: 'danger'}, {label: 'D'}, {label: 'E', tone: 'removed'}, {label: 'F', tone: 'muted'}], {gap: 8}), 892);
  const toneOf = (text: string) => f.texts.find(t => t.text === text)!.tone;
  assert.deepEqual(['A', 'B', 'C', 'D', 'E', 'F'].map(toneOf), ['accent', 'text', 'danger', 'text', 'muted', 'muted']);
});

test('the sub line stays muted in every tone', () => {
  const f = figure(emblemBand([{label: 'A', sub: 'a', tone: 'accent'}, {label: 'B', sub: 'b', tone: 'danger'}]));
  assert.deepEqual([f.texts.find(t => t.text === 'a')!.tone, f.texts.find(t => t.text === 'b')!.tone], ['muted', 'muted']);
});

test('gray-tone-collision sees the tones of an emblem, not only those of boxes', async () => {
  const d = diagram({theme: 'blue', tones: {accent: {fill: '#dddddd'}, changed: {fill: '#e0e0e0'}}} as never).add(emblem([{label: 'A', tone: 'accent'}, {label: 'B', tone: 'changed'}]));
  const r = await checkDiagram(d);
  assert.ok(r.verdict.findings.some(f => f.rule === 'gray-tone-collision'), 'two emblem tones with near-equal grey fills are reported');
  const plain = await checkDiagram(diagram({theme: 'blue'}).add(emblem([{label: 'A', tone: 'accent'}, {label: 'B', tone: 'danger'}])));
  assert.ok(!plain.verdict.findings.some(f => f.rule === 'gray-tone-collision'));
});

test('emblemOutline: the drawn height is the height of the points, the box holds the whole drawing, and the anchor lies inside the box', () => {
  for (const shape of SHAPES) for (let d = 64; d <= 320; d += 8) {
    const o = emblemOutline(shape, 100, 200, d);
    assert.deepEqual([o.box.x, o.box.y, o.box.w, o.box.h], [100, 200, d, o.h], `${shape} ${d}: the box is the drawn rectangle`);
    if (o.points) {
      const ys = o.points.map(p => p[1]), xs = o.points.map(p => p[0]);
      assert.equal(Math.max(...ys) - Math.min(...ys), o.h, `${shape} ${d}: h is the height of the points`);
      assert.deepEqual([Math.min(...xs), Math.max(...xs)], [100, 100 + d], `${shape} ${d}: the points span the width`);
    }
    assert.ok(o.anchor.x >= o.box.x && o.anchor.y >= o.box.y && o.anchor.x + o.anchor.w <= o.box.x + o.box.w && o.anchor.y + o.anchor.h <= o.box.y + o.box.h, `${shape} ${d}: the anchor is inside the box`);
    assert.ok(o.textCy > 0 && o.textCy < o.h, `${shape} ${d}: the text centre is inside the shape`);
    assert.equal([o.points, o.path].filter(Boolean).length <= 1, true, `${shape} ${d}: a polygon or a path, not both (neither: the circle)`);
  }
});

test('the drawn path of a pill / rounded / document / cylinder spans exactly its box (a document\'s wave reaches the bottom)', () => {
  for (const shape of ['pill', 'rounded', 'document', 'cylinder'] as const) for (let d = 64; d <= 320; d += 8) for (const textH of [0, 60, 120]) {
    const h = emblemHeight(shape, d, textH);
    if (h > emblemMaxHeight(shape, d)) continue; // the layout grows D instead
    const o = emblemOutline(shape, 100, 200, d, h), pts = flattenPath(o.path!).flatMap(f => [...f.pts, ...f.extrema]);
    const ys = pts.map(p => p[1]), xs = pts.map(p => p[0]);
    assert.ok(Math.abs(Math.min(...ys) - 200) <= .5 && Math.abs(Math.max(...ys) - (200 + h)) <= .5, `${shape} ${d} (${textH}): y spans ${Math.min(...ys)}..${Math.max(...ys)}, the box is 200..${200 + h}`);
    assert.ok(Math.abs(Math.min(...xs) - 100) <= .5 && Math.abs(Math.max(...xs) - (100 + d)) <= .5, `${shape} ${d}: x spans the width`);
  }
});

test('a shape that is as tall as its text needs (pill, rounded, parallelogram, document, cylinder): a line of sub does not make the whole band bigger', () => {
  const plain = figureReal(emblemBand([{id: 'p', label: '開始', shape: 'pill'}, {id: 'c', label: '課題'}]));
  const withSub = figureReal(emblemBand([{id: 'p', label: '開始', sub: '受付', shape: 'pill'}, {id: 'c', label: '課題'}]));
  assert.equal(withSub.bounds![1]!.w, plain.bounds![1]!.w, 'the circle keeps its size');
  assert.equal(withSub.bounds![0]!.w, plain.bounds![0]!.w, 'the pill keeps its width');
  assert.ok(withSub.bounds![0]!.h > plain.bounds![0]!.h, 'the pill is taller for its second line');
  const lines = figureReal(emblemBand([{id: 'p', label: '一\n二\n三\n四\n五', shape: 'pill'}]));
  assert.ok(lines.bounds![0]!.w <= 176, `five short lines in a pill: ${lines.bounds![0]!.w}px wide, not 320`);
  const long = figureReal(emblemBand([{id: 'r', label: 'あ'.repeat(20), shape: 'rounded'}]));
  assert.equal(long.bounds![0]!.w, 96, 'a long text makes a rounded box taller, not wider');
  for (const shape of EMBLEM_FLEX) assert.equal(emblemHeight(shape, 96, 0), emblemOutline(shape, 0, 0, 96).h, `${shape}: no text needs no more than the default height`);
});
