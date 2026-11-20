// node --test test/   — areas(): bands placed by the named areas of a template, like CSS grid-template-areas (ADR 0069 D3).
import test from 'node:test';
import assert from 'node:assert/strict';
import {areas, box, caption, checkDiagram, closeMeasurer, connect, diagram, group, renderDiagram, rewrite, row, spacer, stat} from '../lib/dsl.ts';
import {areasColumns, parseAreaTemplate} from '../lib/areas.ts';
import {canvasRowHeights, trackRowYs} from '../lib/canvas.ts';
import {fontsOf, planSlide} from '../lib/pptx/slide.ts';
import type {LaidOutBox} from '../lib/types/text-bands.ts';
import type {LaidOutGroup, LaidOutRow} from '../lib/types/containers.ts';
import type {Band} from '../lib/types/index.ts';

test.after(() => closeMeasurer());

const render = async (...bands: Band[]) => (await renderDiagram(diagram({theme: 'blue', title: 't'}).add(...bands), {name: 'x.svg', budget: 'cacheOnly'})).laidOut;
type Laid = Awaited<ReturnType<typeof render>>;
const boxOf = (l: Laid, id: string): LaidOutBox => {
  for (const b of l.laidOut) {
    if (b.type === 'box' && b.id === id) return b;
    if (b.type === 'row') { const c = b.children.find(x => x.id === id); if (c) return c; }
  }
  throw new Error(`no box ${id}`);
};
const frameOf = (l: Laid, id: string) => l.laidOut.find(b => b.type === 'group' && b.id === id) as LaidOutGroup;
const tall = (id: string, opts: {valign?: 'top' | 'center' | 'stretch'; frame?: false} = {}) =>
  group(['a', 'b', 'c', 'd'].map(t => box({title: `${id}-${t}`})), opts.frame === false ? {frame: false, ...(opts.valign ? {valign: opts.valign} : {})} : {title: id, ...(opts.valign ? {valign: opts.valign} : {})});

// ---- the template ----

test('parseAreaTemplate: rows by line (blank lines and indentation dropped) or an array; . is an empty cell; names become rectangles', () => {
  const t = parseAreaTemplate(`
      head  memo  convs
      head  memo  convs
      .     note  note
  `);
  assert.equal(t.cols, 3);
  assert.equal(t.rows, 3);
  assert.deepEqual(t.names, ['head', 'memo', 'convs', 'note']);
  assert.deepEqual(t.place.get('head'), {col: 0, row: 0, cs: 1, rs: 2});
  assert.deepEqual(t.place.get('note'), {col: 1, row: 2, cs: 2, rs: 1});
  const arr = parseAreaTemplate(['head memo convs', 'head memo convs', '.\tnote note']);
  assert.deepEqual([...arr.place], [...t.place], 'an array of rows (tabs separate too) is the same template');
});

test('parseAreaTemplate: a column of empty cells is allowed (a spacer); a row of them, .. / ..., a full-width space and a non-rectangle are not', () => {
  assert.deepEqual(parseAreaTemplate(['a . b', 'c . d']).place.get('b'), {col: 2, row: 0, cs: 1, rs: 1});
  assert.throws(() => parseAreaTemplate(['a b', '. .']), /line 2 is all empty cells/);
  assert.throws(() => parseAreaTemplate(['a .. b']), /"\.\." — an empty cell is a single \./);
  assert.throws(() => parseAreaTemplate(['a ... b']), /"\.\.\."/);
  assert.throws(() => parseAreaTemplate('\n  a b\n  c　d\n'), /line 3, column 4 has a full-width space \(U\+3000\) — separate the names with half-width spaces/);
  assert.throws(() => parseAreaTemplate(['a a', 'a b']), /"a" is not a rectangle/, 'an L shape');
  assert.throws(() => parseAreaTemplate(['a b a']), /"a" is not a rectangle/, 'two separate places');
  assert.throws(() => parseAreaTemplate(['a b', 'c']), /line 2 has 1 cells but the first row has 2/);
  assert.throws(() => parseAreaTemplate(['a b', '', 'c d']), /line 2 is blank/);
  assert.throws(() => parseAreaTemplate(['見出し b']), /"見出し" — a name is ASCII letters/);
  assert.throws(() => parseAreaTemplate([Array.from({length: 13}, (_, i) => `c${i}`).join(' ')]), /13 columns \(at most 12\)/);
  assert.throws(() => parseAreaTemplate('  \n  '), /the template is empty/);
});

test('areas(): the template and the cells name the same areas; cols has one ratio per column', () => {
  assert.throws(() => areas('a b c', {a: box({title: 'a'}), b: box({title: 'b'}), x: box({title: 'x'})} as never), /no cell for "c" — "x" not in the template/);
  assert.throws(() => areas('a b', {a: box({title: 'a'}), b: box({title: 'b'})}, {cols: [1, 2, 3]}), /one width ratio per column — the template has 2 columns/);
  assert.throws(() => areas('a b', {a: box({title: 'a'}), b: box({title: 'b'})}, {cols: [1, 0]}), /every ratio is a number > 0/);
  assert.throws(() => areas('a b', {a: box({title: 'a'}), b: box({title: 'b'})}, {gaps: 4} as never), /unknown option "gaps"/);
  const band = areas('a b', {a: box({title: 'a'}), b: box({title: 'b'})}, {gap: 10});
  assert.equal(band.gap, 12, 'the gap is rounded up to the 4px grid');
  assert.equal(band.rowGap, 12, 'rowGap defaults to the gap');
  assert.deepEqual(band.colW, [1, 1]);
});

test('areas(): placement options, a different id, a band that places others, and a reveal of the whole are errors', () => {
  for (const k of ['span', 'col', 'flex', 'width'] as const) {
    assert.throws(() => areas('a b', {a: box({title: 'a', [k]: 2}), b: box({title: 'b'})}), new RegExp(`area "a" has ${k}: 2 — the template places and sizes an area`), k);
  }
  assert.throws(() => areas('a b', {a: group([box({title: 'x'})], {span: 4}), b: box({title: 'b'})}), /area "a" has span: 4/);
  assert.throws(() => areas('a b', {a: box({title: 'a', id: 'other'}), b: box({title: 'b'})}), /area "a" holds a box\(\) with id "other" — the area's name is its id/);
  assert.throws(() => areas('a b', {a: row([box({title: 'x'})]) as never, b: box({title: 'b'})}), /area "a" is a row\(\) — .*put the row in a group/);
  assert.throws(() => areas('a b', {a: connect('x', 'y') as never, b: box({title: 'b'})}), /area "a" is a connect\(\)/);
  assert.throws(() => areas('a b', {a: spacer(8) as never, b: box({title: 'b'})}), /area "a" is a spacer\(\)/);
  const inner = areas('x', {x: box({title: 'x'})});
  assert.throws(() => areas('a b', {a: inner as never, b: box({title: 'b'})}), /area "a" is a areas\(\) — .*put the inner areas\(\) in a group/);
  assert.doesNotThrow(() => areas('a b', {a: group([inner]), b: box({title: 'b'})}));
  assert.throws(() => row([box({title: 'a'}), inner as never]), /row\(\): child 1 is an areas\(\) — .*put the areas\(\) in a group/);
  assert.throws(() => areas('a b', {a: box({title: 'a'}), b: box({title: 'b'})}, {reveal: 1} as never), /areas\(\): takes no reveal/);
  assert.throws(() => rewrite([areas('a b', {a: box({title: 'a'}), b: box({title: 'b'})})], b => b.type === 'areas' ? {reveal: 2} : undefined), /rewrite\(areas\): cannot change 'reveal'/);
  // the content of a cell carries its own reveal
  const shown = areas('a b', {a: box({title: 'a', reveal: 2}), b: box({title: 'b'})});
  assert.equal(shown.children[0]?.reveal, 2);
});

test('areas(): a caption / table / stat is wrapped in a frameless group that takes the name; the original band is not changed', () => {
  const memo = box({id: 'memo', title: '決定メモ'});
  const band = areas('note memo s', {note: caption('前提は 1 か所に'), memo, s: stat('3', '件')});
  const [note, m, s] = band.children;
  assert.equal(note?.type, 'group');
  assert.equal(note?.type === 'group' && note.frame, false);
  assert.equal(note?.id, 'note');
  assert.equal(m?.type, 'box', 'a stat is a box');
  assert.equal(s?.id, 's');
  assert.notEqual(m, memo, 'the cell holds a copy');
  assert.equal((m as unknown as {right: string}).right, 'memo:right', 'the handles of box({id}) are kept');
  const plain = box({title: 'p'});
  const copy = areas('p', {p: plain}).children[0] as unknown as {id: string; right: string};
  assert.equal(copy.id, 'p');
  assert.equal(copy.right, 'p:right', 'a box without an id gets the name and its handles');
  assert.equal((plain as {id?: string}).id, undefined, 'the box passed in keeps no id');
});

// ---- placement ----

test('areas(): the cells of a column line up across rows; a cell spanning rows is as tall as the rows and the gap between', async () => {
  const l = await render(areas(`
    a  b  c
    d  b  e
  `, {a: box({title: 'a'}), b: box({title: 'b'}), c: box({title: 'c'}), d: box({title: 'd'}), e: box({title: 'e', body: '長めの本文が入って、この箱は高くなる。長めの本文が入って、この箱は高くなる。'})}, {cols: [2, 3, 2], gap: 24, rowGap: 16}));
  const [a, b, c, d, e] = ['a', 'b', 'c', 'd', 'e'].map(id => boxOf(l, id)) as LaidOutBox[];
  assert.equal(a!.x, d!.x); assert.equal(a!.w, d!.w);
  assert.equal(c!.x, e!.x); assert.equal(c!.w, e!.w);
  assert.equal(b!.x - (a!.x + a!.w), 24, 'the column gap');
  assert.ok(b!.w > a!.w * 1.3, 'the cols ratios share the width');
  assert.equal(d!.y - (a!.y + a!.h), 16, 'the row gap');
  assert.equal(b!.y, a!.y);
  assert.equal(b!.y + b!.h, e!.y + e!.h, 'b spans both rows');
  assert.equal(e!.h, d!.h, 'the cells of one row share its height');
  assert.ok(e!.h > a!.h, 'a row is as tall as what its cells need');
  for (const x of [a, b, c, d, e]) { assert.equal(x!.x % 4, 0); assert.equal(x!.y % 4, 0); }
  const wrappers = l.laidOut.filter(x => x.type === 'row') as LaidOutRow[];
  assert.equal(wrappers.length, 5, 'each box comes out in a row of one, as in a row of groups');
});

test('areas(): a group frame is stretched to its cell; a framed group centres its content, a frameless one only with valign (#377)', async () => {
  const at = async (g: ReturnType<typeof group>) => {
    const l = await render(areas('L s', {L: tall('L'), s: g}));
    const s = l.laidOut.find(x => x.type === 'group' && x.id === 's') as LaidOutGroup, L = frameOf(l, 'L');
    return {l, s, L, box: boxOf(l, 'inner')};
  };
  const framed = await at(group([box({id: 'inner', title: 'x'})], {title: 'S'}));
  assert.equal(framed.s.h, framed.L.h, 'the frame is as tall as the cell');
  const above = framed.box.y - framed.s.y, below = framed.s.y + framed.s.h - (framed.box.y + framed.box.h);
  assert.ok(above > 40 && Math.abs(above - below) <= 40, `centred: ${above} above, ${below} below`);
  const top = await at(group([box({id: 'inner', title: 'x'})], {title: 'S', valign: 'top'}));
  assert.ok(top.box.y - top.s.y < 60, 'valign top');
  const bare = await at(group([box({id: 'inner', title: 'x'})], {frame: false}));
  assert.equal(bare.box.y, bare.s.y, 'a frameless group stays at the top');
  const moved = await at(group([box({id: 'inner', title: 'x'})], {frame: false, valign: 'center'}));
  assert.ok(moved.box.y - moved.s.y > 40, 'and moves with valign');
  const st = await at(group([box({id: 'inner', title: 'x'})], {frame: false, valign: 'stretch'}));
  assert.ok(st.box.h > bare.box.h * 2, 'stretch: the single box fills the room');
  const plainBox = await render(areas('L s', {L: tall('L'), s: box({title: 's'})}));
  assert.equal(boxOf(plainBox, 's').h, frameOf(plainBox, 'L').h, 'a box is stretched to its cell (as in a row)');
});

test('areas(): an area narrower than 96px is an error; a column of empty cells may be narrow', async () => {
  await assert.rejects(render(areas('a b c d e f g h i', Object.fromEntries('abcdefghi'.split('').map(n => [n, box({title: n})])), {gap: 24})), /areas: area "a" is only \d+px wide \(at least 96px\)/);
  const l = await render(areas(['a . b', 'c . d'], {a: box({title: 'a'}), b: box({title: 'b'}), c: box({title: 'c'}), d: box({title: 'd'})}, {cols: [4, 0.2, 4], gap: 16}));
  const a = boxOf(l, 'a'), b = boxOf(l, 'b');
  assert.ok(b.x - (a.x + a.w) < 60, `the spacer column is narrow (${b.x - (a.x + a.w)}px between)`);
  assert.ok(b.x - (a.x + a.w) > 32, 'but still a column: two gaps and its share');
});

test('areas(): the names are ids — connect("memo:right", ...) and a handle resolve; areas({id}) is an anchor holding its boxes', async () => {
  const memo = box({id: 'memo', title: '決定メモ'});
  const convs = group([box({id: 'c1', title: '今の会話'}), box({id: 'c2', title: '新しい会話'})], {title: '同じ前提'});
  const fig = areas('memo convs', {memo, convs}, {gap: 64, id: 'all'});
  const l = await render(fig, connect(memo.right, 'c1:left'), connect('convs:bottom', 'note:top'), box({id: 'note', title: 'note'}), connect('all:bottom', 'note:top', {route: 'elbow'}));
  const by = (from: string) => l.connects.find(x => x.fromId === from);
  const c = by('memo'), d = by('convs'), e = by('all');
  const m = boxOf(l, 'memo');
  assert.equal(c!.from.x, m.x + m.w);
  assert.equal(c!.to.x, boxOf(l, 'c1').x);
  assert.equal(d!.from.y, frameOf(l, 'convs').y + frameOf(l, 'convs').h);
  assert.ok(e!.fromArea, 'areas({id}) is an area end: its boxes count as that end');
  await assert.rejects(render(areas('a b', {a: box({title: 'a'}), b: box({title: 'b'})}), box({id: 'a', title: 'again'})), /duplicate anchor id "a"/);
});

test('areas(): a row inside a cell gets the gap its labels need, from the width of the cell (the pre-pass walks the cells)', async () => {
  const inner = row([box({id: 'x', title: 'x'}), box({id: 'y', title: 'y'})], {cols: [6, 6], gap: 8});
  const d = diagram({theme: 'blue'}).add(areas('L R', {L: group([inner], {title: '中の行'}), R: box({title: 'r'})}, {cols: [3, 1]}), connect('x:right', 'y:left', {label: '長めのラベルです', chip: true}));
  assert.deepEqual((await checkDiagram(d)).verdict.problems, []);
});

test('areas(): reveal goes on the content of a cell, and a group in a cell is walked', async () => {
  const r = await renderDiagram(diagram({theme: 'blue', title: 't'}).add(areas('a b', {a: box({title: 'a', reveal: 1}), b: group([box({id: 'in', title: 'in'})], {title: 'G', reveal: 2})})), {name: 'x.svg', budget: 'cacheOnly'});
  assert.equal(boxOf(r.laidOut, 'a').reveal, 1);
  assert.equal(boxOf(r.laidOut, 'in').reveal, 2, 'the box inside the group takes the group\'s stage');
});

test('trackRowYs / canvasRowHeights: the rows of a track grid on the 4px grid, a spanning cell widening the rows it spans', () => {
  const grid = {colW: [1, 1], rowW: [1, 1], place: [{col: 0, row: 0, cs: 1, rs: 1}, {col: 0, row: 1, cs: 1, rs: 1}, {col: 1, row: 0, cs: 1, rs: 2}]};
  const rows = canvasRowHeights(grid, [50, 30, 140], 16, 0);
  assert.deepEqual(rows, [50 + 22, 30 + 22]);
  assert.deepEqual(trackRowYs(8, rows, 16), [8, 8 + 72 + 16, 8 + 72 + 16 + 52 + 16]);
  assert.deepEqual(trackRowYs(0, [49.5], 12), [0, 52 + 12], 'a row height is rounded up to the grid');
});

test('areasColumns: whole 4px steps by the ratios; columns of one ratio are equally wide, the steps left over widen the gutters', () => {
  const even = areasColumns([1, 1, 1, 1], 20, 900, 56);
  assert.deepEqual(even.w, [180, 180, 180, 180], 'not 184 / 184 / 180 / 184');
  assert.deepEqual(even.x, [20, 20 + 180 + 60, 20 + 2 * 240, 20 + 3 * 240], 'the 3 steps left over go one to each gutter');
  const weighted = areasColumns([4, 1, 4], 24, 900, 16);
  assert.equal(weighted.w[0], weighted.w[2]);
  assert.ok([...weighted.x, ...weighted.w].every(v => v % 4 === 0));
  const last = weighted.w.length - 1;
  const right = weighted.x[last]! + weighted.w[last]!;
  assert.ok(right <= 24 + 900 && right > 24 + 900 - 4, `the columns fill the width to under one step (${right})`);
  assert.deepEqual(areasColumns([1], 0, 401, 16), {x: [0], w: [400]});
});

test('PowerPoint: a group in an areas() cell is one group with its frame and contents (ADR 0054 D5)', async () => {
  const r = await render(areas('head memo', {head: group([box({title: '手引き'}), box({title: 'ルール'})], {title: '頭の中'}), memo: box({title: '決定メモ'})}));
  const f = frameOf(r, 'head');
  assert.equal(f.span, 3, 'its title and its two boxes');
  const xml = planSlide(r, fontsOf()).xml;
  const g = /<p:grpSp><p:nvGrpSpPr><p:cNvPr id="\d+" name="group: 頭の中 \[head\]"\/>([\s\S]*?)<\/p:grpSp>/.exec(xml);
  assert.ok(g, 'the group is named after its title and id');
  assert.match(g[1] ?? '', /手引き[\s\S]*ルール/);
  assert.doesNotMatch(g[1] ?? '', /決定メモ/, 'the box of the next cell is not in it');
});
