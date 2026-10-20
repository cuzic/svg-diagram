import test from 'node:test';
import './helpers/strict-width.ts'; // a text the layout did not register for measuring throws instead of measuring 0 wide
import assert from 'node:assert/strict';
import {wordArtTexts, wordartBand} from '../lib/wordart.ts';
import {ROLES} from '../lib/tokens.ts';
import {inside, place} from './helpers/wordart.ts';

test('vertical layout: columns run right to left, inside the figure, and the id is an anchor', () => {
  const f = place('あいう\nえおか\nきくけ', {writing: 'vertical', size: 24, id: 'v'});
  const xs = f.labelBoxes.map(b => b.x);
  assert.ok(xs[0]! > xs[1]! && xs[1]! > xs[2]!, `right to left: ${xs}`);
  for (const b of f.labelBoxes) assert.ok(inside(b, f));
  assert.deepEqual(f.anchors.map(a => a.id), ['v']);
  assert.ok(f.h >= 3 * 24, 'the height holds the longest column');
  const glyphs = f.items.flatMap(i => i.k === 'col' ? i.glyphs : []);
  assert.equal(glyphs.length, 9);
  assert.ok(glyphs.every(g => g.x > f.x && g.x < f.x + f.w));
});

test('horizontal layout wraps to the figure and aligns', () => {
  const long = '一二三四五六七八九十'.repeat(6);
  const f = place(long, {size: 40}, 600);
  assert.ok(f.items.length > 1, 'wrapped');
  for (const b of f.labelBoxes) assert.ok(inside(b, f));
  assert.ok(f.w <= 600 + .5);
  const start = place('左寄せ', {align: 'start'}, 600), end = place('右寄せ', {align: 'end'}, 600);
  assert.ok(start.x < end.x);
  assert.throws(() => place('ABCDEFGHIJKLMNOPQRSTUVWXYZ'.repeat(2), {size: 56}, 300), /needs .*px but the figure/);
  assert.throws(() => place('あ\n'.repeat(8), {writing: 'vertical', size: 56}, 300), /needs .*px but the figure/);
});

test('the ink is inside the band: an outline and a shadow grow its rect', () => {
  const plain = place('見出し', {style: 'bold', size: 40}), fancy = place('見出し', {style: 'sticker', size: 40});
  assert.ok(fancy.w > plain.w && fancy.h > plain.h);
  const plate = place('見出し', {style: 'bold', size: 40, plate: 'accent', tone: 'bg'});
  assert.ok(plate.plate && plate.w > plain.w);
});

test('what the layout measures is registered: every text, at the size and weight it draws', () => {
  const asked = wordArtTexts(wordartBand('令和8年 SVG', {writing: 'vertical', size: 30}), ROLES).map(([t]) => t);
  assert.deepEqual(asked.sort(), ['8', '8', 'SVG'].sort());
  assert.deepEqual(wordArtTexts(wordartBand('一行目\n二行目', {size: 30}), ROLES).map(([t]) => t), ['一行目', '二行目']);
});

test('glow, depth and the bevel widen the ink; a reflection adds height; a turn takes the rotated box', () => {
  const base = place('光る', {style: 'bold', size: 40});
  for (const o of [{glow: true}, {extrude: true}, {bevel: true}]) { const f = place('光る', {style: 'bold', size: 40, ...o}); assert.ok(f.w > base.w && f.h > base.h, JSON.stringify(o)); }
  const r = place('光る', {style: 'bold', size: 40, reflection: true});
  assert.ok(r.h > base.h && r.reflection && r.reflection.clip.y < r.reflection.axis);
  const t = place('光る光る光る', {style: 'bold', size: 40, rotate: 90});
  const u = place('光る光る光る', {style: 'bold', size: 40});
  assert.ok(Math.abs(t.w - u.h) < 1 && Math.abs(t.h - u.w) < 1, 'a quarter turn swaps the box');
  assert.equal(t.labelBoxes.length, 1);
  assert.throws(() => place('あ\n'.repeat(8), {size: 40, rotate: 90}, 300), /needs/);
});

test('arcs: the letters follow the curve, and a bend that would crowd them is refused', () => {
  const f = place('虹形に曲げる', {size: 40, arc: 120});
  const a = f.items[0]!;
  assert.equal(a.k, 'arc');
  if (a.k !== 'arc') return;
  assert.equal(a.glyphs.length, 6);
  assert.ok(a.glyphs[0]!.rot < 0 && a.glyphs[5]!.rot > 0, 'an arch tips outward at both ends');
  assert.ok(a.glyphs[0]!.y > a.glyphs[2]!.y, 'the ends are lower than the middle of the arch');
  for (const b of f.labelBoxes) assert.ok(inside(b, f));
  const sag = place('曲げる曲げる曲げる', {size: 40, arc: -60}).items[0]!;
  assert.ok(sag.k === 'arc' && sag.glyphs[0]!.y < sag.glyphs[4]!.y, 'a sag has its ends higher');
  assert.throws(() => place('笑顔形', {size: 40, arc: -120}), /too tight/);
  assert.deepEqual(wordArtTexts(wordartBand('ab', {arc: 30}), ROLES).map(t => t[0]), ['a', 'b']);
});

test('an emoji with its modifiers is one cell; the id of its defs depends on what it is and where', () => {
  const v = place('👍🏽❤️👨‍👩‍👧', {writing: 'vertical', size: 30}), glyphs = v.items.flatMap(i => i.k === 'col' || i.k === 'rot' ? (i.k === 'col' ? i.glyphs.map(g => g.ch) : [i.text]) : []);
  assert.deepEqual(glyphs, ['👍🏽', '❤️', '👨‍👩‍👧']);
  assert.deepEqual(wordArtTexts(wordartBand('👍🏽❤️', {arc: 30}), ROLES).map(t => t[0]), ['👍🏽', '❤️']);
  assert.equal(place('あ', {style: 'gradient'}).uid, place('あ', {style: 'gradient'}).uid);
  assert.notEqual(place('あ', {style: 'gradient'}).uid, place('い', {style: 'gradient'}).uid);
  assert.notEqual(place('あ', {style: 'gradient'}).uid, place('あ', {style: 'gradient', tone: 'danger', gradient: {from: 'text', to: 'danger'}}).uid);
});
