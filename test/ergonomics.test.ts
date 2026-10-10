// Ergonomics added from project feedback: row({cols: [..]}), a shared column-grid gap, connectDefaults / d.connect(), stateRow().
import test from 'node:test';
import assert from 'node:assert/strict';
import {diagram, box, row, group, connect, branch, swimlane, table, cell, wireframe, screens, plane, stateMatrix, stateRow, wf, checkDiagram, closeMeasurer} from '../lib/dsl.ts';
import type {LaidOutBox, LaidOutPlane, LaidOutRow, RowBand} from '../lib/dsl.ts';

test.after(() => closeMeasurer());

const rowsOf = async (d: ReturnType<typeof diagram>) => (await checkDiagram(d)).laidOut.laidOut.filter((b): b is LaidOutRow => b.type === 'row');
const xs = (r: LaidOutRow) => r.children.map((c: LaidOutBox) => [Math.round(c.x), Math.round(c.w)]);

test('row({cols: [6, 6]}) is a 12-column row of two spans, and lines up with a hand-numbered row', async () => {
  const a = diagram({theme: 'blue'}).add(row([box({title: 'a'}), box({title: 'b'})], {cols: [6, 6]}), row([box({title: 'c', span: 6}), box({title: 'd', span: 6, col: 7})], {cols: 12}));
  const [r1, r2] = await rowsOf(a);
  assert.deepEqual(xs(r1), xs(r2));
});

test('row({cols: [..]}) checks its spans', () => {
  assert.throws(() => row([box({title: 'a'})], {cols: [6, 6]}), /declares 2 spans for 1 children/);
  assert.throws(() => row([box({title: 'a'})], {cols: [0]}), /whole number >= 1/);
  assert.throws(() => row([box({title: 'a', span: 3})], {cols: [6]}), /already gives it span 6/);
  assert.equal((row([box({title: 'a'}), box({title: 'b'})], {cols: [3, 9]}) as RowBand).cols, 12);
});

test('row({cols: [..]}) keeps the id handles of its children and works with groups', async () => {
  const r = row([box({id: 'a', title: 'a'}), box({id: 'b', title: 'b'})], {cols: [4, 8]}) as RowBand;
  assert.equal((r.children[0] as unknown as {right: string}).right, 'a:right');
  const g = row([group([box({id: 'x', title: 'x'})], {title: 'G'}), group([box({id: 'y', title: 'y'})], {title: 'H'})], {cols: [5, 7]});
  assert.deepEqual((await checkDiagram(diagram({theme: 'blue'}).add(g))).verdict.problems, []);
});

test('on a column grid the gap grows for every row of that grid, so the columns stay aligned', async () => {
  const label = {label: '長めのラベルがここに入ります', chip: true};
  const mk = (withLabel: boolean) => {
    const d = diagram({theme: 'blue'}).add(
      row([box({id: 'a', title: '左'}), box({id: 'b', title: '右'})], {cols: [2, 2], gap: 8}),
      row([box({title: 'c', span: 2}), box({title: 'd', span: 2})], {cols: 4, gap: 8}),
    );
    if (withLabel) d.add(connect('a:right', 'b:left', label));
    return d;
  };
  const [plain1] = await rowsOf(mk(false)), [wide1, wide2] = await rowsOf(mk(true));
  const gap = (r: LaidOutRow) => r.children[1].x - (r.children[0].x + r.children[0].w);
  assert.equal(Math.round(gap(plain1)), 8);
  assert.ok(gap(wide1) > 8, 'the labelled row gets the room');
  assert.equal(Math.round(gap(wide1)), Math.round(gap(wide2)), 'and so does the other row of the same grid');
  assert.deepEqual(xs(wide1), xs(wide2));
  assert.deepEqual((await checkDiagram(mk(true))).verdict.problems, []);
});

test('a column grid keeps its gap when growing it would squeeze the boxes', async () => {
  const d = diagram({theme: 'blue'}).add(
    row(Array.from({length: 12}, (_, i) => box({id: `c${i}`, title: String(i)})), {cols: 12, gap: 8}),
    connect('c0:right', 'c1:left', {label: '長めのラベルがここに入ります', chip: true}),
  );
  const [r] = await rowsOf(d);
  assert.equal(Math.round(r.children[1].x - (r.children[0].x + r.children[0].w)), 8);
});

test('connectDefaults fill in what a connector leaves out; what it sets wins', async () => {
  const d = diagram({theme: 'blue', connectDefaults: {chip: true, route: 'elbow', tone: 'accent'}});
  d.add(row([box({id: 'a', title: 'a'}), box({id: 'b', title: 'b'}), box({id: 'c', title: 'c'})]));
  d.add(connect('a:right', 'b:left', {label: 'x'}), connect('b:right', 'c:left'), connect('a:bottom', 'c:bottom', {route: 'loop-under', label: 'y', chip: false}));
  d.connect('a:right', 'c:left', {label: 'z'});
  const cs = (await checkDiagram(d)).laidOut.connects;
  assert.deepEqual(cs.map(c => [c.route, c.chip, c.tone]), [['elbow', true, 'accent'], ['elbow', false, 'accent'], ['loop-under', false, 'accent'], ['elbow', true, 'accent']], 'a chip needs a label; an explicit route / chip stays');
});

test('connectDefaults reach branch() and connectors inside a group, and do not leak into other diagrams', async () => {
  const d = diagram({theme: 'blue', connectDefaults: {arrow: 'both', line: 'dashed'}});
  d.add(group([row([box({id: 'a', title: 'a'}), box({id: 'b', title: 'b'})]), connect('a:right', 'b:left', {marker: false, dashed: false})]), ...[branch('a:bottom', [{to: 'b:bottom'}])]);
  const [g1, g2] = (await checkDiagram(d)).laidOut.connects;
  assert.deepEqual([g1.arrow, g1.line], ['none', 'solid'], 'legacy marker/dashed outrank the defaults');
  assert.deepEqual([g2.arrow, g2.line], ['both', 'dashed']);
  const other = diagram({theme: 'blue'}).add(row([box({id: 'a', title: 'a'}), box({id: 'b', title: 'b'})]), connect('a:right', 'b:left'));
  assert.deepEqual((await checkDiagram(other)).laidOut.connects.map(c => [c.arrow, c.line]), [['end', 'solid']]);
});
test('stateRow(): one part, a diff per state; the same cells as writing them out', async () => {
  const card = (o: {state?: 'loading' | 'empty'; title?: string} = {}) => wf.card([wf.text('在庫')], {title: 'T', ...o});
  const cols = ['通常', '読み込み中', '空'];
  const a = stateMatrix(cols, [stateRow('カード', card, {通常: {}, 読み込み中: 'loading', 空: {na: '必ず 1 件ある'}}, {note: 'n'})]);
  const b = stateMatrix(cols, [{label: 'カード', note: 'n', cells: [card(), card({state: 'loading'}), {na: '必ず 1 件ある'}]}]);
  assert.deepEqual(a.matrix, b.matrix);
  const c = stateMatrix(cols, [stateRow('カード', card, {通常: {}, 読み込み中: {title: 'X'}, 空: undefined}, {base: {state: 'empty'}})]);
  assert.deepEqual(c.matrix!.rows[0].cells, [card({state: 'empty'}), card({state: 'empty', title: 'X'}), undefined]);
});

test('stateRow(): a state that is not a column throws', () => {
  const card = (o: object = {}) => wf.card([wf.text('x')], o);
  assert.throws(() => stateMatrix(['通常'], [stateRow('カード', card, {通常: {}, 空: {}})] as never), /"空" is not a column/);
});

test('table cell({mark}): a symbol in front of the text, with its tone, and the cell widths measure the symbol', async () => {
  const t = table([{label: '方式'}, {label: '通る'}], [[ 'A', cell('通る', {mark: 'ok'})], ['B', cell('', {mark: 'ng'})], ['C', cell('条件付き', {mark: 'mid', tone: 'muted'})], ['D', cell('最適', {mark: 'best'})]]);
  const {laidOut, verdict} = await checkDiagram(diagram({theme: 'blue'}).add(t));
  assert.deepEqual(verdict.problems, []);
  const tb = laidOut.laidOut.find(b => b.type === 'table') as unknown as {rows: {cells: {text: string; tone?: string; bold: boolean}[]}[]};
  const cells = tb.rows.filter(r => r.cells[1] && !('header' in r && (r as {header?: boolean}).header)).map(r => r.cells[1]);
  assert.deepEqual(cells.map(c => [c.text, c.tone, c.bold]), [['○ 通る', 'accent', false], ['×', 'danger', false], ['△ 条件付き', 'muted', false], ['◎ 最適', 'accent', true]]);
});

test('wireframeDefaults: an app bar above every screen, the selected nav item per screen, defaults a screen can override', async () => {
  const d = diagram({theme: 'blue', wireframeDefaults: {appbar: {title: '在庫管理', nav: ['ダッシュボード', '在庫', '設定'], right: ['田中']}, h: 200, frame: 'light'}});
  d.add(
    wireframe(wf.text('在庫の一覧'), {shell: {active: '在庫'}}),
    wireframe(wf.text('設定'), {shell: {active: 2, title: '設定画面'}, h: 260}),
    wireframe(wf.text('部品だけ'), {shell: false}),
    screens([{id: 's1', title: 'A', root: wf.text('a'), shell: {active: 'ダッシュボード'}}, {id: 's2', title: 'B', root: [wf.text('b1'), wf.text('b2')]}]),
  );
  const [w1, w2, w3, sc] = d.bands as unknown as {root: {t: string; title?: string; active?: number; nav?: string[]; right?: string[]}[] | {t: string}; h?: number; frame?: string; items?: {root: unknown; h?: number}[]}[];
  const root = (b: typeof w1) => [b.root].flat() as {t: string; title?: string; active?: number; nav?: string[]; right?: string[]}[];
  assert.deepEqual(root(w1).map(n => n.t), ['appbar', 'text']);
  assert.deepEqual([root(w1)[0].title, root(w1)[0].active, root(w1)[0].nav!.length, root(w1)[0].right], ['在庫管理', 1, 3, ['田中']]);
  assert.deepEqual([root(w2)[0].title, root(w2)[0].active, w2.h, w2.frame], ['設定画面', 2, 260, 'light'], 'the screen\'s own h wins, the default frame fills in');
  assert.deepEqual([root(w3).map(n => n.t), w3.h], [['text'], 200], 'shell: false skips the bar but keeps the other defaults');
  assert.deepEqual(sc.items!.map(i => [[i.root].flat().map(n => (n as {t: string}).t), i.h]), [[['appbar', 'text'], 200], [['appbar', 'text', 'text'], 200]]);
  assert.deepEqual((await checkDiagram(d)).verdict.problems, []);
  d.add(w1 as never); // adding the same band again must not wrap it twice
  assert.deepEqual(root(w1).map(n => n.t), ['appbar', 'text']);
});

test('wireframeDefaults: an unknown nav item throws; a custom shell function wraps the content', () => {
  const d = diagram({theme: 'blue', wireframeDefaults: {appbar: {title: 'X', nav: ['a', 'b']}}});
  assert.throws(() => d.add(wireframe(wf.text('t'), {shell: {active: 'c'}})), /"c" is not one of the nav items/);
  const e = diagram({theme: 'blue', wireframeDefaults: {shell: (content, p) => wf.col([wf.text(`${p.section}`), ...content])}});
  const w = wireframe(wf.text('t'), {shell: {section: '設定'}});
  e.add(w);
  assert.deepEqual([(e.bands[0] as {root: {t: string}}).root.t], ['col']);
  assert.equal((w.root as {t: string}).t, 'text', 'the band the caller holds is not changed');
});

test('row({id}).col(n): a column of a row is a connect() anchor (its top / bottom edge, whatever the boxes in it are)', async () => {
  const top = row([box({id: 'a', title: 'a'}), box({id: 'b', title: 'b'})], {cols: [8, 4], id: 'top'});
  const bottom = row([box({id: 'c', title: 'c', span: 3}), box({id: 'e', title: 'e', span: 9, col: 4})], {cols: 12, id: 'bottom'});
  const d = diagram({theme: 'blue'}).add(top, bottom, connect(top.col(5).bottom, bottom.col(2).top, {route: 'elbow'}), connect('bottom#4-12:top', 'top#2:bottom', {route: 'elbow', bend: 0.3}), connect(top.col(1, 6).top, top.col(7, 12).top, {route: 'loop-under'}));
  const {laidOut, verdict} = await checkDiagram(d);
  assert.deepEqual(verdict.problems, []);
  const [r1, r2] = laidOut.laidOut.filter((b): b is LaidOutRow => b.type === 'row');
  const cs = laidOut.connects;
  const colW = (r1.w - 11 * 16) / 12;
  assert.equal(Math.round(cs[0].from.x), Math.round(r1.x + 4 * (colW + 16) + colW / 2), 'the middle of the 5th column of the top row');
  assert.equal(Math.round(cs[0].to.x), Math.round(r2.x + 1 * (colW + 16) + colW / 2), 'the middle of the 2nd column of the bottom row');
  assert.equal(Math.round(cs[0].from.y), Math.round(r1.y + r1.h));
  assert.equal(Math.round(cs[1].from.x), Math.round(r2.x + 3 * (colW + 16) + (9 * colW + 8 * 16) / 2), 'columns 4..12 as one');
  assert.equal(Math.round(cs[2].to.x), Math.round(r1.x + 6 * (colW + 16) + (6 * colW + 5 * 16) / 2), 'a span of columns too');
  assert.equal(Math.round(cs[2].from.x), Math.round(r1.x + (6 * colW + 5 * 16) / 2));
});

test('row({id}).col(n) on a row without cols is its n-th child; bad column numbers throw', async () => {
  const r = row([box({title: 'x'}), box({title: 'y'}), box({title: 'z'})], {id: 'r'});
  const d = diagram({theme: 'blue'}).add(r, connect('r#2:bottom', 'r#3:bottom', {route: 'loop-under'}), connect(r.col(1, 2).top, r.col(3).top, {route: 'loop-under'}));
  const {laidOut} = await checkDiagram(d);
  const row0 = laidOut.laidOut.find((b): b is LaidOutRow => b.type === 'row')!;
  const mid = row0.children[1];
  assert.equal(Math.round(laidOut.connects[0].from.x), Math.round(mid.x + mid.w / 2));
  assert.throws(() => r.col(0), /whole numbers, 1-based/);
  assert.throws(() => r.col(3, 2), /in order/);
  const bad = diagram({theme: 'blue'}).add(r, connect('r#9:top', 'r#1:top'));
  await assert.rejects(checkDiagram(bad), /unknown anchor id "r#9"/);
});

test('plane(): points and dimension lines land where their coordinates say, and the build checks pass', async () => {
  const d = diagram({theme: 'blue'}).add(plane({
    x: {label: 'x', max: 100, step: 25}, y: {label: 'y', max: 50, step: 10},
    points: [{id: 'a', at: [25, 10], label: 'A'}, {id: 'b', at: [75, 40], label: 'B', labelAt: 'above'}],
    lines: [{from: 'a', to: [25, 0]}],
    dims: [{from: 'a', to: 'b', label: '50', side: 'below'}],
  }));
  const {laidOut, verdict} = await checkDiagram(d);
  assert.deepEqual(verdict.problems, []);
  const p = laidOut.laidOut.find((b): b is LaidOutPlane => b.type === 'plane')!;
  const [a, b] = p.points;
  assert.equal(Math.round((a.x - p.plotL) / (p.plotR - p.plotL) * 100), 25, 'x = 25 of 0..100');
  assert.equal(Math.round((b.x - p.plotL) / (p.plotR - p.plotL) * 100), 75);
  assert.equal(Math.round((p.plotB - b.y) / (p.plotB - p.plotT) * 50), 40, 'y grows upward');
  assert.ok(p.dims[0].line.y1 > a.y, 'a dimension line on the "below" side runs below the segment');
  assert.deepEqual(p.ticks.length, 5 + 6);
  const down = (await checkDiagram(diagram({theme: 'blue'}).add(plane({x: {max: 10}, y: {max: 10}, yDown: true, points: [{at: [0, 10]}]})))).laidOut.laidOut.find((q): q is LaidOutPlane => q.type === 'plane')!;
  assert.ok(down.points[0].y > down.axisY + 100, 'with yDown the origin is the top-left corner and y = 10 is at the bottom');
});

test('plane(): labels that sit on each other, or leave the figure, are reported; a bad point id or axis throws', async () => {
  const crowded = plane({x: {max: 10}, y: {max: 10}, points: [{at: [5, 5], label: 'ひとつめの点'}, {at: [5.1, 5], label: 'ふたつめの点'}]});
  const v = (await checkDiagram(diagram({theme: 'blue'}).add(crowded))).verdict;
  assert.ok(v.problems.some(p => /plane: label "ひとつめの点" overlaps label "ふたつめの点"/.test(p)), v.problems.join('\n'));
  const out = plane({x: {max: 10}, y: {max: 10}, points: [{at: [10, 5], label: 'とても長いラベルがはみ出す'}]});
  assert.ok((await checkDiagram(diagram({theme: 'blue'}).add(out))).verdict.problems.some(p => /runs outside the figure/.test(p)));
  await assert.rejects(checkDiagram(diagram({theme: 'blue'}).add(plane({x: {max: 10}, y: {max: 10}, dims: [{from: 'nope', to: [1, 1], label: 'x'}]}))), /"nope" is not a point id/);
  assert.throws(() => plane({x: {max: 0}, y: {max: 10}}), /axis x needs max > min/);
  assert.throws(() => plane({y: {max: 10}} as never), /"x" needs an axis/);
});

test('one primitive each: a wireframe chip is a pill, an alert mark is a badge, and the SVG carries them', async () => {
  const d = diagram({theme: 'blue'}).add(wireframe(wf.col([wf.chip('稼働中', {tone: 'accent'}), wf.alert('接続が切れています', {tone: 'danger'})]), {h: 'fit'}));
  const {laidOut} = await checkDiagram(d);
  const w = laidOut.laidOut.find(b => b.type === 'wireframe') as unknown as {prims: {k: string; label?: string}[]};
  assert.deepEqual(w.prims.filter(p => p.k === 'pill' || p.k === 'badge').map(p => [p.k, p.label]), [['pill', '稼働中'], ['badge', '!']]);
  const {emitSvg} = await import('../lib/emit.ts');
  const svg = emitSvg(laidOut);
  assert.match(svg, /<rect [^>]*rx="12"[^>]*\/>\s*<text [^>]*font-weight="700"[^>]*>稼働中<\/text>/);
  assert.match(svg, /<g role="img" aria-label="警告" data-badge>/);
});

test('connector chips and box tags are pills too, and a plain connector label stays a bare text', async () => {
  const d = diagram({theme: 'blue'}).add(row([box({id: 'a', title: 'a', tag: '新規'}), box({id: 'b', title: 'b'}), box({id: 'c', title: 'c'})]), connect('a:right', 'b:left', {label: 'tcp', chip: true}), connect('b:right', 'c:left', {label: 'udp'}));
  const {emitSvg} = await import('../lib/emit.ts');
  const svg = emitSvg((await checkDiagram(d)).laidOut);
  assert.match(svg, /rx="12" fill="#1d5fa8"\/>\s*<text [^>]*font-size="14" font-weight="700" fill="#ffffff">新規<\/text>/);
  assert.match(svg, /rx="12" fill="#ffffff" stroke="#22201b" stroke-width="2"\/>\s*<text [^>]*font-size="14" fill="#22201b">tcp<\/text>/);
  assert.match(svg, /<text [^>]*font-size="14" fill="#22201b">udp<\/text>/);
});

// ---- review fixes ----
test('plane(): a 4-digit last tick does not collide with the x axis name; a bad step throws', async () => {
  const p = plane({x: {label: '距離 [m]', max: 2500, step: 500}, y: {max: 10}});
  assert.deepEqual((await checkDiagram(diagram({theme: 'blue'}).add(p))).verdict.problems, []);
  assert.throws(() => plane({x: {max: 10, step: 0}, y: {max: 10}}), /step must be a number > 0/);
  assert.throws(() => plane({x: {max: 10}, y: {max: 10, step: -2}}), /axis y step/);
  assert.throws(() => plane({x: {max: 10, step: NaN}, y: {max: 10}}), /step must be a number > 0/);
});

test('connectDefaults leave swimlane() flows alone', async () => {
  const d = diagram({theme: 'blue', connectDefaults: {line: 'dashed', arrow: 'none', route: 'straight'}});
  d.add(swimlane([{id: 'a', label: 'A'}, {id: 'b', label: 'B'}], [{id: 's1', lane: 'a', title: '1'}, {id: 's2', lane: 'b', title: '2'}], {flows: [{from: 's1', to: 's2'}]}));
  const [c] = (await checkDiagram(d)).laidOut.connects;
  assert.deepEqual([c.line, c.arrow, c.route], ['solid', 'end', 'elbow']);
});

test('defaults never change the band the caller holds, so it can go into another diagram unchanged', async () => {
  const c = connect('a:right', 'b:left'), w = wireframe(wf.text('x'), {shell: {active: 0}});
  const boxes = row([box({id: 'a', title: 'a'}), box({id: 'b', title: 'b'})]);
  const d1 = diagram({theme: 'blue', connectDefaults: {line: 'dashed'}, wireframeDefaults: {appbar: {title: 'T', nav: ['n']}}}).add(boxes, c, w);
  const d2 = diagram({theme: 'blue'}).add(boxes, c, w);
  assert.equal((await checkDiagram(d1)).laidOut.connects[0].line, 'dashed');
  assert.equal((await checkDiagram(d2)).laidOut.connects[0].line, 'solid');
  assert.equal([(d2.bands[2] as {root: unknown}).root].flat().length, 1);
  assert.equal([(d1.bands[2] as {root: unknown}).root].flat().length, 2);
});

test('a part option called `na` next to others is an option; `{na: reason}` alone is the not-applicable marker', () => {
  const part = (o: {na?: string; x?: number} = {}) => wf.text(`${o.na ?? ''}${o.x ?? ''}`);
  const m = stateMatrix(['a', 'b'], [stateRow('r', part, {a: {na: 'p', x: 1}, b: {na: 'reason'}})]);
  const [a, b] = m.matrix!.rows[0].cells;
  assert.equal((a as {text: string}).text, 'p1');
  assert.deepEqual(b, {na: 'reason'});
});

test('shell callouts are numbered before the content\'s (the shell is on top of the screen)', () => {
  const d = diagram({theme: 'blue', wireframeDefaults: {shell: (content) => wf.col([wf.text('bar', {n: true}), ...content])}});
  const w = wireframe(wf.col([wf.text('a', {n: true}), wf.text('b', {n: 5}), wf.text('c', {n: true})]));
  d.add(w);
  const root = (d.bands[0] as unknown as {root: {children: ({n?: number; children?: {n: number}[]})[]}}).root;
  assert.equal(root.children[0].n, 6, 'the shell bar comes after the explicit 5');
  assert.deepEqual(root.children[1].children!.map(n => n.n), [7, 5, 8], 'the content auto numbers follow it');
});

test('duplicate ids with a row or its columns are an error', async () => {
  const boxes = () => [box({id: 'x', title: 'x'}), box({id: 'y', title: 'y'})];
  await assert.rejects(checkDiagram(diagram({theme: 'blue'}).add(box({id: 'r', title: 'r'}), row(boxes(), {id: 'r'}))), /duplicate anchor id "r"/);
  await assert.rejects(checkDiagram(diagram({theme: 'blue'}).add(row(boxes(), {id: 'r'}), box({id: 'r', title: 'again'}))), /duplicate anchor id "r"/);
  await assert.rejects(checkDiagram(diagram({theme: 'blue'}).add(row(boxes(), {id: 'r'}), row([box({id: 'q', title: 'q'})], {id: 'r'}))), /duplicate anchor id "r"/);
  await assert.rejects(checkDiagram(diagram({theme: 'blue'}).add(row(boxes(), {id: 'r'}), box({id: 'r#2', title: 'z'}))), /duplicate anchor id "r#2"/);
});

test('a nested grouprow gets the same gap in the pre-pass as in the layout (labelled connector between its groups)', async () => {
  const inner = row([group([box({id: 'a', title: 'a'})], {title: 'L'}), group([box({id: 'b', title: 'b'})], {title: 'R'})], {cols: [6, 6], gap: 8});
  const d = diagram({theme: 'blue'}).add(inner, connect('a:right', 'b:left', {label: '長めのラベルです', chip: true}));
  assert.deepEqual((await checkDiagram(d)).verdict.problems, []);
});

// ---- plane(): labels against the plane's ink (feedback from a real figure) ----
const planeProblems = async (p: ReturnType<typeof plane>) => (await checkDiagram(diagram({theme: 'blue'}).add(p))).verdict.problems;
const axes = {x: {label: 'x', max: 100, step: 25}, y: {label: 'y', max: 50, step: 10}};

test('plane(): a label on an axis line, a tick label or an arrowhead is reported', async () => {
  const origin = await planeProblems(plane({...axes, labels: [{at: [0, 0], text: '原点', anchor: 'end'}]}));
  assert.ok(origin.some(p => /label "原点" overlaps the y axis/.test(p)), origin.join('\n'));
  assert.ok(origin.some(p => /label "0" overlaps label "原点"/.test(p)), 'and the tick label "0"');
  const onTick = await planeProblems(plane({...axes, labels: [{at: [0, 20], text: '起点', anchor: 'end'}]}));
  assert.ok(onTick.some(p => /label "20" overlaps label "起点"/.test(p)), onTick.join('\n'));
  const arrow = await planeProblems(plane({...axes, labels: [{at: [100, 0], text: '端', anchor: 'middle'}]}));
  assert.ok(arrow.some(p => /label "端" overlaps the x axis arrow/.test(p)), arrow.join('\n'));
  const mark = await planeProblems(plane({...axes, labels: [{at: [50, 0], text: '中央', anchor: 'middle'}]}));
  assert.ok(mark.some(p => /label "中央" overlaps (the x axis|a tick mark)/.test(p)), mark.join('\n'));
});

test('plane(): a short dimension line whose label sits on the axis is reported; its own line is not', async () => {
  const near = await planeProblems(plane({...axes, dims: [{from: [25, 0], to: [50, 0], label: '25', side: 'above', offset: 6}]}));
  assert.ok(near.some(p => /label "25" overlaps the x axis/.test(p)), near.join('\n'));
  const fine = await planeProblems(plane({...axes, dims: [{from: [25, 0], to: [75, 0], label: '50 m', side: 'above'}]}));
  assert.deepEqual(fine, [], 'a dimension label sits on its own line by design');
  const other = await planeProblems(plane({...axes, dims: [{from: [10, 10], to: [90, 10], label: '80'}, {from: [50, 8], to: [50, 40], label: '32', side: 'left', offset: 2}]}));
  assert.ok(other.some(p => /overlaps a dimension line/.test(p)), 'another dimension\'s line is ink too: ' + other.join('\n'));
});

test('plane(): points, guide lines and the axis name keep their space', async () => {
  const point = await planeProblems(plane({...axes, points: [{id: 'a', at: [50, 25]}], labels: [{at: [50, 25], text: 'ここ', anchor: 'start'}]}));
  assert.ok(point.some(p => /label "ここ" overlaps a point/.test(p)), point.join('\n'));
  const guide = await planeProblems(plane({...axes, points: [{id: 'a', at: [50, 25]}], lines: [{from: 'a', to: [50, 0]}], labels: [{at: [50, 10], text: '補助', anchor: 'middle'}]}));
  assert.ok(guide.some(p => /label "補助" overlaps a guide line/.test(p)), guide.join('\n'));
  for (const yDown of [false, true]) assert.deepEqual(await planeProblems(plane({...axes, yDown})), [], `axis names and ticks are clear of the arrows (yDown: ${yDown})`);
});

test('plane(): the wide head of a guide-line arrow is ink too', async () => {
  const p = await planeProblems(plane({...axes, lines: [{from: [10, 40], to: [60, 40], arrow: true}], labels: [{at: [60, 38], text: '先', anchor: 'middle'}]}));
  assert.ok(p.some(m => /label "先" overlaps a guide line arrow/.test(m)), p.join('\n'));
});
