import test from 'node:test';
import assert from 'node:assert/strict';
import {labelCover, hidesArrow} from '../lib/connect-rules.ts';

const line = (len: number) => [{x: 0, y: 0}, {x: 0, y: len}];

test('labelCover: the part of the route under the chip, and what is left', () => {
  const short = labelCover({points: line(27), chipBox: {x: -23, y: 2, w: 46, h: 24}})!;
  assert.ok(Math.abs(short.share - 24 / 27) < 1e-9 && Math.abs(short.visible - 3) < 1e-9);
  assert.equal(hidesArrow(short), true);
  const long = labelCover({points: line(107), chipBox: {x: -22, y: 40, w: 44, h: 24}})!;
  assert.ok(long.share < 0.3);
  assert.equal(hidesArrow(long), false);
});

test('labelCover: a long arrow whose label covers much of it still shows its head; no label rectangle means no verdict; elbows are clipped per segment', () => {
  const wide = labelCover({points: [{x: 0, y: 0}, {x: 100, y: 0}], chipBox: {x: 0, y: -12, w: 72, h: 24}})!;
  assert.ok(wide.share > 0.6 && wide.visible === 28);
  assert.equal(hidesArrow(wide), false); // 28px of shaft and head remain
  assert.equal(labelCover({points: line(30)}), undefined);
  const elbow = labelCover({points: [{x: 0, y: 0}, {x: 0, y: 20}, {x: 20, y: 20}], chipBox: {x: -10, y: 5, w: 40, h: 30}})!;
  assert.ok(Math.abs(elbow.visible - 5) < 1e-9, String(elbow.visible)); // 15 of the first leg + 20 of the second are under the chip
});
