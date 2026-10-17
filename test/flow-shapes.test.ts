import test from 'node:test';
import './helpers/strict-width.ts'; // a label the layout did not register for measuring throws instead of measuring 0 wide
import assert from 'node:assert/strict';
import {chevron, concentric, cycle, diagram, funnel, renderDiagram, venn} from '../lib/dsl.ts';
import {layoutFlowShape} from '../lib/flow-shapes.ts';
import {renderFlowShape} from '../lib/emit.ts';
import {ROLES, NO_TONES} from '../lib/tokens.ts';
import type {FlowShapeBand, LaidOutFlowShape} from '../lib/flow-shapes.ts';
import type {Rect} from '../lib/types/core.ts';

// a rough width (0.58 em per character) is enough to check the geometry without measuring fonts
const roughWidth = (atom: string, size: number) => Array.from(atom).length * size * .58;
const figure = (band: FlowShapeBand, width = 892): LaidOutFlowShape => layoutFlowShape(band, 24, 24, width, roughWidth, ROLES);
const inside = (t: Rect, f: Rect) => t.x >= f.x - .5 && t.y >= f.y - .5 && t.x + t.w <= f.x + f.w + .5 && t.y + t.h <= f.y + f.h + .5;
const overlaps = (a: Rect, b: Rect) => Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 1 && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 1;
const textAt = (f: LaidOutFlowShape, text: string) => { const t = f.texts.find(x => x.text === text); assert.ok(t, `no text "${text}"`); return t; };

const samples = (): FlowShapeBand[] => [
  chevron([{id: 'a', label: '長い工程名を折り返す', sub: '補足説明'}, {id: 'b', label: '次'}]),
  chevron([{label: '受付'}, {label: '内容の分類'}, {label: '担当者が回答'}], {direction: 'vertical', first: 'chevron'}),
  funnel([{id: 'a', label: '入口', value: 100}, {id: 'b', label: '問い合わせの多い段', value: 20}, {label: '成約', value: 5}], {scale: 'value', showRate: true}),
  funnel([{label: '全候補'}, {label: '一次選考'}, {label: '最終候補'}, {label: '採用'}, {label: '入社'}, {label: '定着'}, {label: '昇進'}, {label: '幹部'}], {showRate: true}),
  cycle([{id: 'a', label: '計画', sub: '目標を決める'}, {id: 'b', label: '実行'}, {id: 'c', label: '確認'}], {centre: '改善'}),
  cycle(Array.from({length: 8}, (_, i) => ({id: `n${i}`, label: `段階${i + 1}`})), {direction: 'ccw'}),
  venn([{name: 'A', id: 'a'}, {name: 'B', id: 'b'}], {overlaps: [{sets: ['A', 'B'], label: '共通'}], universe: '全体'}),
  venn([{name: '顧客'}, {name: '自社'}, {name: '競合'}], {overlaps: [{sets: ['顧客', '自社'], label: '提供価値'}, {sets: ['自社', '競合'], label: '差別化'}, {sets: ['顧客', '競合'], label: '代替'}], centre: '勝ち筋'}),
  concentric([{label: '外', id: 'a', description: '入口を守る'}, {label: '中'}, {label: '内', id: 'b', description: '暗号化する'}], {centre: '重要情報'}),
  concentric([{label: 'チーム'}, {label: '顧客と取引先'}, {label: '社会'}], {order: 'inner-first', labels: 'side', centre: '利用者'}),
];

test('every flow shape keeps its labels inside the figure and apart from each other', () => {
  for (const band of samples()) {
    const f = figure(band);
    for (const t of f.labelBoxes) assert.ok(inside(t, f), `${f.type}: "${t.label}" runs outside the figure`);
    for (const [i, a] of f.labelBoxes.entries()) for (const b of f.labelBoxes.slice(i + 1)) assert.ok(!overlaps(a, b), `${f.type}: "${a.label}" overlaps "${b.label}"`);
  }
});

test('item ids become anchors; chevron, funnel and cycle anchors do not overlap', () => {
  for (const band of samples()) {
    const f = figure(band), ids = (band.type === 'funnel' ? band.stages : band.type === 'venn' ? band.sets : band.type === 'concentric' ? band.rings : band.steps).flatMap(x => x.id ? [x.id] : []);
    assert.deepEqual(f.anchors.map(a => a.id), ids);
    if (f.type === 'venn' || f.type === 'concentric') continue; // nested / intersecting by design
    for (const [i, a] of f.anchors.entries()) for (const b of f.anchors.slice(i + 1)) assert.ok(!overlaps(a, b), `${f.type}: ${a.id} overlaps ${b.id}`);
  }
});

test('cycle: arrows run between the nodes, never into one', () => {
  const f = figure(cycle([{label: 'Plan'}, {label: 'Do'}, {label: 'Check'}, {label: 'Act'}]));
  const nodes = f.primitives.flatMap(p => p.k === 'circle' ? [p] : []);
  for (const p of f.primitives) {
    if (p.k !== 'path') continue;
    const ends = [...p.d.matchAll(/(-?[\d.]+),(-?[\d.]+)/g)].map(m => [+m[1], +m[2]]).filter((_, i) => i !== 1); // skip the arc radii
    for (const [x, y] of ends) for (const c of nodes) assert.ok(Math.hypot(x - c.cx, y - c.cy) > c.r, `an arrow end (${x}, ${y}) is inside a node`);
  }
});

test('venn of three: a pair label sits where only that pair overlaps; set labels where only their set is', () => {
  const f = figure(venn([{name: 'A'}, {name: 'B'}, {name: 'C'}], {overlaps: [{sets: ['A', 'B'], label: 'AB'}], centre: 'ABC'}));
  const circles = f.primitives.flatMap(p => p.k === 'circle' ? [p] : []);
  const within = (t: {tx: number; ty: number; size: number}) => circles.map(c => Math.hypot(t.tx - c.cx, t.ty - t.size * .35 - c.cy) < c.r);
  assert.deepEqual(within(textAt(f, 'AB')), [true, true, false]);
  assert.deepEqual(within(textAt(f, 'ABC')), [true, true, true]);
  assert.deepEqual(within(textAt(f, 'A')), [true, false, false]);
  assert.deepEqual(within(textAt(f, 'C')), [false, false, true]);
});

test('venn: the three outlines differ in dash pattern, not only in colour', () => {
  const svg = renderFlowShape(figure(venn([{name: 'A'}, {name: 'B'}, {name: 'C'}])), 'blue', NO_TONES);
  const dashes = [...svg.matchAll(/<circle[^>]*>/g)].map(m => /stroke-dasharray="([^"]+)"/.exec(m[0])?.[1] ?? 'solid');
  assert.equal(new Set(dashes).size, 3);
});

test('funnel: each stage starts as wide as the one above ends', () => {
  const f = figure(funnel([{label: 'a', value: 1000}, {label: 'b', value: 400}, {label: 'c', value: 20}, {label: 'd', value: 10}], {scale: 'value'}));
  const polys = f.primitives.flatMap(p => p.k === 'polygon' ? [p.points] : []);
  for (let i = 1; i < polys.length; i++) assert.equal(polys[i][1][0] - polys[i][0][0], polys[i - 1][2][0] - polys[i - 1][3][0]);
});

test('concentric side key: one leader per ring, from the key into its ring', () => {
  const f = figure(concentric([{label: '外'}, {label: '中'}, {label: '内'}], {labels: 'side'}));
  assert.equal(f.primitives.filter(p => p.k === 'path').length, 3);
});

test('the layout measures exactly what it draws (strict widths), and the verdict is clean', async () => {
  for (const band of samples()) {
    const r = await renderDiagram(diagram({theme: 'blue', title: 'flow'}).add(band), {name: 'f.svg', budget: 'cacheOnly'});
    assert.ok(r.verdict.ok, `${band.type}: ${r.verdict.problems.join('; ')}`);
  }
});

test('validation errors are helpful', () => {
  assert.throws(() => cycle([{label: 'a'}, {label: 'b'}]), /3\.\.8/);
  assert.throws(() => venn([{name: 'A'}]), /2 or 3/);
  assert.throws(() => venn([{name: 'A'}, {name: 'B'}], {overlaps: [{sets: ['A', 'A'], label: 'x'}]}), /2 or more different sets/);
  assert.throws(() => venn([{name: 'A'}, {name: 'B'}], {overlaps: [{sets: ['A', 'B'], label: 'x'}, {sets: ['B', 'A'], label: 'y'}]}), /same sets/);
  assert.throws(() => venn([{name: 'A'}, {name: 'B'}], {overlaps: [{sets: ['A', 'B'], label: 'x'}], centre: 'c'}), /both label/);
  assert.throws(() => funnel([{label: 'A', value: 2}, {label: 'B'}], {scale: 'value'}), /requires a value/);
  assert.throws(() => chevron([{label: 'A'}], {current: 2}), /zero-based/);
  assert.throws(() => cycle([{label: 'a'}, {label: 'b'}, {label: 'c', tone: 'blue' as never}]), /unknown tone/);
});

test('emission draws the geometry and escapes labels', () => {
  const bands = [chevron([{label: '矢羽根'}]), funnel([{label: '漏斗'}]), cycle([{label: '循環1'}, {label: '循環2'}, {label: '循環3'}]), venn([{name: '集合&A'}, {name: '集合B'}]), concentric([{label: '同心円'}])];
  for (const b of bands) {
    const svg = renderFlowShape(figure(b), 'blue', NO_TONES);
    assert.match(svg, /<(polygon|circle|path)/);
    assert.ok(!svg.includes('集合&A'));
  }
});
