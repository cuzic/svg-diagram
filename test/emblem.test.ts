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
