import test from 'node:test';
import './helpers/strict-width.ts'; // a label the layout did not register for measuring throws instead of measuring 0 wide
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {box, build, caption, checkDiagram, closeMeasurer, connect, diagram, quadrant, renderDiagram} from '../lib/dsl.ts';
import {QUADRANT_PRESETS, sizeRefs} from '../lib/quadrant.ts';
import type {LaidOutQuadrant, QuadrantItem, QuadrantPreset} from '../lib/quadrant.ts';

test.after(() => closeMeasurer());

const laid = async (...bands: unknown[]) => checkDiagram(diagram({theme: 'blue'}).add(...(bands as never[])));
const figure = async (...bands: unknown[]): Promise<LaidOutQuadrant> => {
  const {laidOut, verdict} = await laid(...bands);
  assert.deepEqual(verdict.problems, []);
  return laidOut.laidOut.find(b => b.type === 'quadrant') as LaidOutQuadrant;
};
const near = (a: number, b: number, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} is not ${b}`);

// ---- the model --------------------------------------------------------------------------------------------------------------

test('presets: every one fills axes, grid, captions and tones, and the grid has the framework\'s shape', () => {
  const shape: Record<QuadrantPreset, [number, number]> = {bcg: [2, 2], ge: [3, 3], ansoff: [2, 2], nineBox: [3, 3], impactEffort: [2, 2], risk: [3, 3], stakeholder: [2, 2], positioning: [2, 2], eisenhower: [2, 2]};
  assert.deepEqual([...QUADRANT_PRESETS].sort(), Object.keys(shape).sort());
  for (const name of QUADRANT_PRESETS) {
    const q = quadrant.preset(name);
    assert.deepEqual([q.cols, q.rows], shape[name], name);
    assert.ok(q.x.title && q.y.title, name);
    assert.equal(q.cells.length, q.rows);
    for (const row of q.cells) assert.equal(row.length, q.cols);
    if (name !== 'positioning') for (const row of q.cells) for (const c of row) assert.ok(c.title, `${name}: every cell is named in words`);
  }
  assert.deepEqual(quadrant({preset: 'bcg'}).cells.flat().map(c => c.title), ['花形', '問題児', '金のなる木', '負け犬']);
  assert.equal(quadrant.preset('bcg').x.reversed, true); // share is drawn high -> low
  assert.deepEqual(quadrant.preset('ansoff').cells.flat().map(c => c.title), ['市場浸透', '新製品開発', '新市場開拓', '多角化']);
  assert.equal(quadrant.preset('positioning').crosshair, true);
});

test('risk preset: the rating of every cell is written, and equals likelihood x impact', () => {
  const q = quadrant.preset('risk');
  const word = (s: number) => s >= 9 ? '重大' : s >= 6 ? '高' : s >= 3 ? '中' : '低';
  q.cells.forEach((row, r) => row.forEach((c, k) => assert.equal(c.title, `リスク ${word((3 - r) * (k + 1))}`)));
  assert.deepEqual(new Set(q.cells.flat().map(c => c.tone)), new Set(['plain', 'changed', 'accent', 'danger']));
});

test('options override a preset (axis fields, one cell), and a preset\'s captions give way to a different grid', () => {
  const q = quadrant({preset: 'bcg', x: {title: '自社シェア'}, cells: [[{title: 'スター'}]]});
  assert.equal(q.x.title, '自社シェア');
  assert.equal(q.x.low, '低'); // the rest of the axis stays
  assert.equal(q.cells[0][0].title, 'スター');
  assert.equal(q.cells[0][0].tone, 'accent');
  assert.equal(q.cells[0][1].title, '問題児');
  const g = quadrant({preset: 'bcg', grid: [3, 2]});
  assert.deepEqual([g.cols, g.rows], [3, 2]);
  assert.equal(g.cells.flat().filter(c => c.title).length, 0);
  assert.deepEqual([quadrant({x: {title: 'a'}, y: {title: 'b'}, cells: [[{}, {}, {}], [{}, {}, {}]]}).cols], [3]);
});

test('validation: every mistake names the item and what to write', () => {
  const ok = {x: {title: 'x'}, y: {title: 'y'}};
  assert.throws(() => quadrant({preset: 'nope' as never}), /unknown preset "nope"/);
  assert.throws(() => quadrant({y: {title: 'y'}}), /axis x needs a title/);
  assert.throws(() => quadrant({...ok, grid: [0, 2]}), /grid must be whole numbers/);
  assert.throws(() => quadrant({...ok, grid: [1, 1]}), /one cell is not a matrix/);
  assert.throws(() => quadrant({...ok, items: [{label: 'a'}]}), /exactly one of cell/);
  assert.throws(() => quadrant({...ok, items: [{label: 'a', cell: [0, 0], at: [0.1, 0.1]}]}), /exactly one of cell/);
  assert.throws(() => quadrant({...ok, items: [{label: 'a', cell: [2, 0]}]}), /outside the 2 x 2 grid/);
  assert.throws(() => quadrant({...ok, items: [{label: 'a', at: [1.2, 0]}]}), /from 0 to 1/);
  assert.throws(() => quadrant({...ok, items: [{label: 'a', at: [0, 0], size: 0}]}), /size must be a number > 0/);
  assert.throws(() => quadrant({...ok, items: [{label: 'a', id: 'q', at: [0, 0]}, {label: 'b', id: 'q', at: [1, 1]}]}), /"q" is used twice/);
  assert.throws(() => quadrant({...ok, items: [{label: 'a', id: 'q', at: [0, 0]}], arrows: [{from: 'q', to: 'z'}]}), /to "z" is not the id of an item/);
  assert.throws(() => quadrant({...ok, sizeTitle: '売上', items: [{label: 'a', at: [0, 0]}]}), /no item has a size/);
  assert.throws(() => quadrant({...ok, grid: [2, 2], cells: [[{}, {}, {}]]}), /cells row 1 has 3 cells but the grid has 2/);
});

test('sizeRefs: round reference values not above the largest size', () => {
  assert.deepEqual(sizeRefs(300), [200, 20]);
  assert.deepEqual(sizeRefs(120), [100, 10]);
  assert.deepEqual(sizeRefs(4000), [2000, 200]);
  assert.deepEqual(sizeRefs(0.7), [0.5, 0.05]);
});

// ---- layout -----------------------------------------------------------------------------------------------------------------

test('coordinates are value space: a reversed axis flips the picture but not the numbers', async () => {
  const mk = (reversed: boolean) => quadrant({x: {title: 'x', reversed}, y: {title: 'y', reversed}, items: [{label: 'P', at: [0.9, 0.9]}]});
  const a = await figure(mk(false)), b = await figure(mk(true));
  const c = (f: LaidOutQuadrant) => ({x: f.bubbles[0].x, y: f.bubbles[0].y, mx: f.plot.x + f.plot.w / 2, my: f.plot.y + f.plot.h / 2});
  assert.ok(c(a).x > c(a).mx && c(a).y < c(a).my, 'high x is right, high y is up');
  assert.ok(c(b).x < c(b).mx && c(b).y > c(b).my, 'reversed: high x is left, high y is down');
});

test('an item stays in the cell its coordinates name, and the cell index is as drawn', async () => {
  const f = await figure(quadrant.preset('bcg', {items: [{label: 'S', at: [0.9, 0.9]}, {label: 'D', at: [0.1, 0.1]}, {label: 'Q', cell: [1, 0]}]}));
  const inCell = (i: number) => f.cells.findIndex(c => f.bubbles[i].x >= c.x && f.bubbles[i].x <= c.x + c.w && f.bubbles[i].y >= c.y && f.bubbles[i].y <= c.y + c.h);
  assert.equal(inCell(0), 0, 'high share, high growth = 花形 (top-left)');
  assert.equal(inCell(1), 3, 'low share, low growth = 負け犬 (bottom-right)');
  assert.equal(inCell(2), 1);
});

test('a coordinate item never lies on the caption of its cell', async () => {
  const f = await figure(quadrant.preset('bcg', {items: [{label: 'top', at: [0.9, 1]}, {label: 'top2', at: [0.1, 1]}]}));
  const caps = f.labelBoxes.filter(b => b.kind === 'caption');
  for (const q of f.bubbles) for (const c of caps) assert.ok(Math.hypot(q.x - Math.max(c.x, Math.min(q.x, c.x + c.w)), q.y - Math.max(c.y, Math.min(q.y, c.y + c.h))) >= q.cr);
});

test('bubble area is proportional to size', async () => {
  const f = await figure(quadrant({x: {title: 'x'}, y: {title: 'y'}, sizeTitle: '売上', sizeUnit: '億円', items: [{label: 'a', at: [0.2, 0.2], size: 100}, {label: 'b', at: [0.8, 0.8], size: 25}, {label: 'c', at: [0.8, 0.2], size: 400}]}));
  const [a, b, c] = f.bubbles;
  near(a.r ** 2 / b.r ** 2, 4, 1e-9);
  near(c.r ** 2 / a.r ** 2, 4, 1e-9);
  assert.ok(f.texts.some(t => t.text === '円の面積 = 売上'));
  assert.ok(f.texts.some(t => t.text === '200億円'), 'the legend names a round reference size');
  const ref = f.marks.find(m => m.ring)!; // the largest reference circle, drawn with the same scale
  near(ref.r ** 2 / c.r ** 2, 200 / 400, 1e-9);
});

test('items of a group get their own shape and colour and a legend; the shapes have equal area', async () => {
  const f = await figure(quadrant({x: {title: 'x'}, y: {title: 'y'}, groups: ['自社', '競合', '新規', '海外'], items: [
    {label: 'a', at: [0.1, 0.1], group: '自社'}, {label: 'b', at: [0.4, 0.1], group: '競合'}, {label: 'c', at: [0.7, 0.1], group: '新規'}, {label: 'd', at: [0.9, 0.9], group: '海外'},
  ]}));
  assert.deepEqual(f.bubbles.map(b => b.shape), ['circle', 'square', 'diamond', 'triangle']);
  assert.equal(new Set(f.bubbles.map(b => `${b.shape}/${b.tone}`)).size, 4);
  for (const g of ['自社', '競合', '新規', '海外']) assert.ok(f.texts.some(t => t.text === g), `legend entry ${g}`);
  assert.equal(f.marks.filter(m => !m.ring).length, 4);
  near(f.bubbles[0].r, f.bubbles[1].r);
});

test('cell-placed items fill their cell without overlap, and the rows grow when the cell is crowded', async () => {
  const items: QuadrantItem[] = Array.from({length: 14}, (_v, i) => ({label: `項目${i + 1}の名前`, cell: [0, 0] as [number, number]}));
  const small = await figure(quadrant.preset('bcg', {items: items.slice(0, 2), height: 300}));
  const big = await figure(quadrant.preset('bcg', {items, height: 300}));
  assert.ok(big.plot.h > small.plot.h, 'the plot grew to hold 14 items');
  const cell = big.cells[0];
  for (const q of big.bubbles) assert.ok(q.x >= cell.x && q.x <= cell.x + cell.w && q.y >= cell.y && q.y <= cell.y + cell.h);
});

test('items given the same coordinates are pushed apart, and those that moved far are reported', async () => {
  const f = await figure(quadrant({x: {title: 'x'}, y: {title: 'y'}, items: Array.from({length: 6}, (_v, i) => ({label: `P${i}`, at: [0.7, 0.7] as [number, number]}))}));
  assert.equal(f.moved.length, 5);
  for (let i = 0; i < 6; i++) for (let j = i + 1; j < 6; j++) assert.ok(Math.hypot(f.bubbles[i].x - f.bubbles[j].x, f.bubbles[i].y - f.bubbles[j].y) >= f.bubbles[i].cr + f.bubbles[j].cr);
});

test('a label wider than its cell throws and says which', async () => {
  await assert.rejects(laid(quadrant({x: {title: 'x'}, y: {title: 'y'}, grid: [8, 1], items: [{label: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', cell: [0, 0]}]})), /fewer columns|wider than its cell/);
});

test('an impossible crowd throws a message naming the item', async () => {
  const items = Array.from({length: 120}, (_v, i) => ({label: `長めのラベル${i}`, at: [0.5, 0.5] as [number, number], size: 50}));
  await assert.rejects(laid(quadrant({x: {title: 'x'}, y: {title: 'y'}, items})), /even with the rows grown/);
});

test('arrows: between items (trimmed to the edges) and to a coordinate, with a label chip kept off items', async () => {
  const f = await figure(quadrant({x: {title: 'x'}, y: {title: 'y'}, items: [{id: 'a', label: 'A', at: [0.2, 0.2], size: 10}, {id: 'b', label: 'B', at: [0.8, 0.8], size: 10}], arrows: [{from: 'a', to: 'b', label: '1 年後'}, {from: 'b', to: [0.8, 0.2], dashed: true}]}));
  assert.equal(f.arrows.length, 2);
  const [a, b] = f.bubbles;
  near(Math.hypot(f.arrows[0].x1 - a.x, f.arrows[0].y1 - a.y), a.cr + 3, 1e-6);
  near(Math.hypot(f.arrows[0].x2 - b.x, f.arrows[0].y2 - b.y), b.cr + 3, 1e-6);
  assert.equal(f.arrows[1].dashed, true);
  assert.equal(f.chips.length, 1);
  await assert.rejects(laid(quadrant({x: {title: 'x'}, y: {title: 'y'}, items: [{id: 'a', label: 'A', at: [0.2, 0.2]}], arrows: [{from: 'a', to: [0.2, 0.2]}]})), /too short/);
});

test('an arrow that would cross an item label makes the label take another side', async () => {
  const f = await figure(quadrant({x: {title: 'x'}, y: {title: 'y'}, items: [{id: 'a', label: 'ラベルA', at: [0.2, 0.5]}, {id: 'b', label: 'ラベルB', at: [0.8, 0.5]}], arrows: [{from: 'a', to: 'b'}]}));
  const a = f.labelBoxes.find(b => b.label === 'ラベルA')!;
  const arrow = f.arrows[0];
  assert.ok(!(arrow.y1 >= a.y - 1 && arrow.y1 <= a.y + a.h + 1 && a.x + a.w > arrow.x1 && a.x < arrow.x2), 'the label is not on the arrow');
});

// ---- the figure in a diagram ------------------------------------------------------------------------------------------------

test('item ids are anchors: connect() reaches them, spotlight lights one and dims the rest', async () => {
  const q = quadrant({id: 'q', x: {title: 'x'}, y: {title: 'y'}, items: [{id: 'a', label: 'A', at: [0.2, 0.2]}, {id: 'b', label: 'B', at: [0.8, 0.8]}, {label: 'C', at: [0.8, 0.2]}]});
  const d = diagram({theme: 'blue', spotlight: 'a'}).add(q, box({id: 'n', title: '注記'}), connect('n:top', 'a:bottom'));
  const {laidOut, verdict} = await checkDiagram(d);
  assert.deepEqual(verdict.problems, []);
  const f = laidOut.laidOut.find(b => b.type === 'quadrant') as LaidOutQuadrant;
  assert.deepEqual(f.bubbles.map(b => !!b.dim), [false, true, true]);
  assert.equal(laidOut.connects.length, 1);
  await assert.rejects(checkDiagram(diagram({theme: 'blue'}).add(q, connect('n', 'zzz') as never)), /zzz|unknown/);
});

test('the figure takes reveal like any band and its item ids come with it', async () => {
  const d = diagram({theme: 'blue'}).add(caption('a'), quadrant({id: 'q', reveal: 2, x: {title: 'x'}, y: {title: 'y'}, items: [{id: 'a', label: 'A', at: [0.2, 0.2]}]}), box({id: 'n', title: 'n', reveal: 1}), connect('n:top', 'a:bottom'));
  const r = await renderDiagram(d, {name: 'q.svg', budget: 'cacheOnly'});
  assert.equal(r.laidOut.maxReveal, 2);
  assert.equal(r.laidOut.connects[0].reveal, 2);
});

test('dark appearance and a narrow figure render without a problem', async () => {
  const r = await renderDiagram(diagram({theme: 'blue', appearance: 'dark', width: 640}).add(quadrant.preset('bcg', {items: [{label: 'A', at: [0.5, 0.5], size: 5}], sizeTitle: 'x'})), {name: 'q.svg', budget: 'cacheOnly'});
  assert.deepEqual(r.verdict.problems, []);
  assert.ok(r.svg.includes('花形'));
});

test('lint rules: tone-only items warn, a moved item warns, groups do not', async () => {
  const base = {x: {title: 'x'}, y: {title: 'y'}};
  const tone = await laid(quadrant({...base, items: [{label: 'a', at: [0.2, 0.2], tone: 'danger'}, {label: 'b', at: [0.8, 0.8], tone: 'muted'}]}));
  assert.ok(tone.verdict.findings.some(f => f.rule === 'quadrant-tone-only'));
  const grouped = await laid(quadrant({...base, items: [{label: 'a', at: [0.2, 0.2], group: 'g1'}, {label: 'b', at: [0.8, 0.8], group: 'g2'}]}));
  assert.ok(!grouped.verdict.findings.some(f => f.rule === 'quadrant-tone-only'));
  const crowd = await laid(quadrant({...base, items: Array.from({length: 6}, (_v, i) => ({label: `長い名前の項目${i}`, at: [0.5, 0.5] as [number, number], size: 80}))}));
  assert.ok(crowd.verdict.findings.some(f => f.rule === 'quadrant-item-moved'));
});

test('every preset passes verify, the rules without a single warning, and the strict SVG lint', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'quadrant-'));
  const items: Record<QuadrantPreset, QuadrantItem[]> = {
    bcg: [{id: 'a', label: 'クラウド', at: [0.8, 0.8], size: 120}, {label: 'パッケージ', at: [0.8, 0.2], size: 300}, {label: '新規 AI', cell: [1, 0]}],
    ge: [{label: '決済', at: [0.9, 0.9], size: 80}, {label: '物流', at: [0.5, 0.5], size: 200}, {label: '旧店舗', cell: [2, 2]}],
    ansoff: [{label: '増量パック', cell: [0, 0]}, {label: '無糖', cell: [1, 0]}, {label: '海外', cell: [0, 1]}, {label: '健康食品', cell: [1, 1]}],
    nineBox: [{label: '田中', cell: [2, 0]}, {label: '佐藤', at: [0.5, 0.5]}, {label: '鈴木', at: [0.1, 0.1]}],
    impactEffort: [{label: '自動取込', at: [0.8, 0.8], size: 30}, {label: '刷新', at: [0.2, 0.9], size: 90}],
    risk: [{label: 'R1 変更', cell: [1, 0]}, {label: 'R2 離脱', cell: [2, 0]}, {label: 'R3 停電', cell: [2, 2]}],
    stakeholder: [{label: 'CFO', at: [0.9, 0.9], group: '社内'}, {label: '官庁', at: [0.2, 0.9], group: '社外'}],
    positioning: [{label: '自社', at: [0.6, 0.7], group: '自社'}, {label: '競合', at: [0.3, 0.2], group: '競合'}],
    eisenhower: [{label: '障害対応', cell: [0, 0]}, {label: '勉強', cell: [1, 0]}, {label: '雑務', cell: [0, 1]}],
  };
  for (const name of QUADRANT_PRESETS) {
    const d = diagram({theme: 'blue', title: name}).add(quadrant.preset(name, {items: items[name], sizeTitle: items[name].some(i => i.size) ? '値' : undefined}));
    const {verdict} = await checkDiagram(d);
    assert.deepEqual(verdict.problems, [], name);
    assert.deepEqual(verdict.warnings, [], name);
    await build(d, path.join(dir, `${name}.svg`)); // build() runs lint-svg --strict and throws on a finding
    assert.ok(fs.readFileSync(path.join(dir, `${name}.svg`), 'utf8').includes('<svg'), name);
  }
});

// ---- a seeded sweep: random items, random labels, no overlap, ever ----------------------------------------------------------

test('a seeded sweep of items at random coordinates / cells with random sizes and labels: nothing overlaps, nothing throws', async () => {
  let seed = 20261012;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  const words = ['クラウド', 'A', 'パッケージ販売', 'Long label name here', '旧システム', 'AI 新規事業', '海外', '保守', 'Quick', '研究開発の拠点'];
  const bad: string[] = [];
  const presets: (QuadrantPreset | undefined)[] = [undefined, 'bcg', 'ge', 'ansoff', 'nineBox', 'risk', 'positioning', 'stakeholder'];
  for (let t = 0; t < 120; t++) {
    const preset = presets[t % presets.length];
    const n = 1 + Math.floor(rnd() * 10), sized = rnd() < 0.5, grouped = rnd() < 0.4;
    const base = preset ? quadrant.preset(preset) : undefined;
    const cols = base?.cols ?? 2 + Math.floor(rnd() * 3), rows = base?.rows ?? 2 + Math.floor(rnd() * 2);
    const items: QuadrantItem[] = Array.from({length: n}, (_v, i) => {
      const label = `${words[Math.floor(rnd() * words.length)]}${i}`;
      const common = {label, ...(sized ? {size: 1 + Math.floor(rnd() * 500)} : {}), ...(grouped ? {group: `G${Math.floor(rnd() * 4)}`} : {})};
      return rnd() < 0.5 ? {...common, at: [rnd(), rnd()] as [number, number]} : {...common, cell: [Math.floor(rnd() * cols), Math.floor(rnd() * rows)] as [number, number]};
    });
    try {
      const band = preset ? quadrant.preset(preset, {items, ...(sized ? {sizeTitle: '値'} : {})}) : quadrant({x: {title: '横軸', low: '低', high: '高', reversed: rnd() < 0.3}, y: {title: '縦軸', low: '低', high: '高', reversed: rnd() < 0.3}, grid: [cols, rows], items, ...(sized ? {sizeTitle: '値'} : {})});
      const {laidOut, verdict} = await laid(band);
      if (verdict.problems.length) bad.push(`#${t} ${preset ?? 'free'} ${cols}x${rows} n=${n}: ${verdict.problems[0]}`);
      const f = laidOut.laidOut.find(b => b.type === 'quadrant') as LaidOutQuadrant;
      // an independent check of the geometry (not verify's): circles and label boxes are pairwise apart
      f.bubbles.forEach((q, i) => {
        for (let j = i + 1; j < f.bubbles.length; j++) if (Math.hypot(q.x - f.bubbles[j].x, q.y - f.bubbles[j].y) < q.cr + f.bubbles[j].cr) bad.push(`#${t}: bubbles ${i} and ${j} overlap`);
      });
      const boxes = f.labelBoxes;
      for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i], b = boxes[j];
        if (Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 0.5 && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 0.5) bad.push(`#${t}: labels "${a.label}" and "${b.label}" overlap`);
      }
    } catch (e) { bad.push(`#${t} ${preset ?? 'free'} ${cols}x${rows} n=${n}: ${(e as Error).message}`); }
  }
  assert.deepEqual(bad, []);
});
