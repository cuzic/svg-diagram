// node --test test/wireframe.test.ts — wireframe() / screens() layout, callouts, overlays, errors.
// These lay out real text, so they need the headless Chromium that measure.ts uses.
import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import {diagram, wireframe, screens, wf, closeMeasurer} from '../lib/dsl.ts';
import {layoutDiagram} from '../lib/layout-measured.ts';
import type {Band, LaidOutScreens, LaidOutWireframe, PrimRect, PrimText, Prim, Rect} from '../lib/types.ts';

after(() => closeMeasurer());

type Screen = LaidOutWireframe | LaidOutScreens;
const layout = async (...bands: Band[]) => {
  const d = diagram({theme: 'blue'});
  d.add(...bands);
  return (await layoutDiagram(d)).laidOut as Screen[];
};
const isText = (p: Prim): p is PrimText => p.k === 'text';
const texts = (band: Screen) => band.prims.flatMap(p => p.k === 'badge' || p.k === 'pill' ? [p.label] : isText(p) ? [p.s] : []);
const within = (p: Prim, b: Rect, slack = 16) => p.k !== 'rect' || (p.x >= b.x - slack && p.y >= b.y - slack && p.x + p.w <= b.x + b.w + slack && p.y + p.h <= b.y + b.h + slack);

test('wireframe: lays out a screen with its notes, every shape stays inside the band', async () => {
  const [band] = await layout(wireframe([wf.appbar('App', {nav: ['A', 'B']}), wf.text('こんにちは')], {title: 'S', h: 200, id: 'a', notes: ['メモ']}));
  assert.equal(band.type, 'wireframe');
  assert.ok(band.h > 200, 'band includes the title row above the frame');
  assert.deepEqual(band.anchors.map(a => a.id), ['a']);
  assert.ok(band.prims.every(p => within(p, band)));
  assert.ok(texts(band).includes('こんにちは') && texts(band).includes('メモ'));
});

test('wireframe: content taller than the screen is an error that says which container', async () => {
  await assert.rejects(
    layout(wireframe([wf.card([wf.text('a'), wf.text('b'), wf.text('c')], {title: 'Card'})], {h: 60})),
    /"col of card" \(col\) needs \d+px of height but only \d+px is available/);
});

test('wireframe: callout draws a numbered circle; mark draws an outline and a legend entry', async () => {
  const [band] = await layout(wireframe([wf.btn('OK', {n: 7, mark: 'new'})], {h: 120}));
  assert.ok(texts(band).includes('7'));
  assert.ok(band.prims.some(p => (p.k === 'circle' || p.k === 'badge') && p.fill === 'accent'));
  assert.ok(band.prims.some(p => p.k === 'rect' && p.dash === '6,4'), 'dashed outline for new');
  assert.ok(texts(band).includes('新規'), 'legend names the mark');
});

test('wireframe: a katakana word is never broken across lines', async () => {
  const [band] = await layout(wireframe([wf.row([wf.text('ドラッグで位置を調整する', {w: 120})])], {h: 160}));
  const lines = texts(band).filter(t => /ドラッ|グ/.test(t));
  assert.ok(lines.length > 0);
  assert.ok(lines.every(l => !/ドラッ$/.test(l) && !/^グ/.test(l)), JSON.stringify(lines));
});

test('wireframe: flex visuals fill the leftover height', async () => {
  const [band] = await layout(wireframe([wf.text('top'), wf.video({label: 'V'})], {h: 300}));
  const video = band.prims.filter((p): p is PrimRect => p.k === 'rect' && p.fill === 'code').sort((a, b) => b.h - a.h)[0];
  assert.ok(video.h > 200, `video should take the rest, got ${video.h}`);
});

test('dialog overlay dims the screen, hides what it covers, and puts the callout inside the card', async () => {
  const [band] = await layout(wireframe([wf.text('under-the-dialog', {align: 'center'}), wf.text('x')], {
    h: 150, overlays: [wf.dialog('確認', {body: '本当に削除しますか？', buttons: [wf.btn('はい')], n: 4})],
  }));
  assert.ok(band.prims.some(p => p.k === 'rect' && p.fill === 'text' && p.op === 0.3), 'dim layer');
  assert.ok(texts(band).includes('確認') && texts(band).includes('はい'));
  assert.ok(!texts(band).includes('under-the-dialog'), 'covered text is not drawn');
  assert.ok(texts(band).includes('4'));
});

test('toast overlay sits at the bottom right of the screen', async () => {
  const [band] = await layout(wireframe([wf.text('x')], {h: 200, overlays: [wf.toast('保存しました')]}));
  const toast = band.prims.find((p): p is PrimRect => p.k === 'rect' && p.fill === 'text' && p.r === 6)!;
  const frame = band.prims.find((p): p is PrimRect => p.k === 'rect' && p.stroke === 'text' && p.sw === 2.5)!;
  assert.ok(toast.x + toast.w <= frame.x + frame.w && toast.y + toast.h <= frame.y + frame.h);
  assert.ok(toast.x > frame.x + frame.w / 2 && toast.y > frame.y + frame.h / 2);
});

test('map: markers, route and legend are drawn', async () => {
  const [band] = await layout(wireframe([wf.map({markers: [{x: 0.5, y: 0.5, kind: 'alert', label: '異常'}], route: [[0.1, 0.1], [0.9, 0.9]], legend: [{kind: 'alert', label: '凡例A'}]})], {h: 240}));
  assert.ok(texts(band).includes('異常') && texts(band).includes('凡例A'));
  assert.ok(band.prims.some(p => p.k === 'path' && p.dash === '8,5'), 'dashed route');
});

test('screens: items get anchors; fractional `at` columns centre a parent over its children', async () => {
  const mini = [wf.text('x')];
  const [band] = await layout(screens([
    {id: 'p', title: 'P', root: mini, at: [0, 0.5]},
    {id: 'c1', title: 'C1', root: mini, at: [1, 0]},
    {id: 'c2', title: 'C2', root: mini, at: [1, 1]},
  ], {gap: 20, rowGap: 40, h: 80}));
  const a = Object.fromEntries(band.anchors.map(x => [x.id, x]));
  assert.ok(Math.abs((a.p.x + a.p.w / 2) - ((a.c1.x + a.c1.w / 2 + a.c2.x + a.c2.w / 2) / 2)) < 1, 'parent centred over children');
  assert.ok(a.c1.y > a.p.y + a.p.h, 'children are on the next row');
  assert.ok(a.p.h > 80, 'anchor includes the title row');
});

test('skeleton: body text becomes bars, titles stay text', async () => {
  const [band] = await layout(wireframe([wf.text('本文のテキスト'), wf.btn('保存')], {h: 160, skeleton: true}));
  assert.ok(!texts(band).includes('本文のテキスト'));
  assert.ok(texts(band).includes('保存'));
});
