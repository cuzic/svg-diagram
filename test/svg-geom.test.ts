// lib/svg-geom.ts: paths, shapes, sampling along an outline, and the box of a text.
import test from 'node:test';
import assert from 'node:assert/strict';
import {flattenPath, outlineOf, sampleAlong, boxOf, unionBox, transformBox, corners, familyKind, textBoxOf, isShape, type Point} from '../lib/svg-geom.ts';
import {parseXml, computeStyles, elements, parseTransform, type El} from '../lib/svg-dom.ts';
import {textBox, resolveFontFile} from '../lib/font-metrics.ts';

const haveFont = resolveFontFile('sans') !== null;
const near = (a: number, b: number, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} vs ${b}`);
const nearPt = (p: Point, x: number, y: number, eps = 1e-6) => { near(p[0], x, eps); near(p[1], y, eps); };
const root = (inner: string, attrs = '') => parseXml(`<svg xmlns="http://www.w3.org/2000/svg" ${attrs}>${inner}</svg>`);
const el = (inner: string, id = 'e') => elements(root(inner)).find(e => e.attrs.id === id)!;
const VP = {w: 400, h: 200};

// ---- boxes ----

test('boxOf and unionBox', () => {
  assert.deepEqual(boxOf([[1, 2], [5, 9], [3, 4]]), {x: 1, y: 2, w: 4, h: 7});
  assert.equal(boxOf([]), null);
  assert.deepEqual(unionBox([{x: 0, y: 0, w: 2, h: 2}, null, {x: 5, y: 1, w: 1, h: 10}]), {x: 0, y: 0, w: 6, h: 11});
  assert.equal(unionBox([null, null]), null);
  assert.equal(unionBox([]), null);
});

test('transformBox is the box of the transformed corners', () => {
  const b = transformBox({x: 0, y: 0, w: 10, h: 10}, parseTransform('rotate(90)'));
  near(b.x, -10); near(b.y, 0); near(b.w, 10); near(b.h, 10);
  const c = transformBox({x: 0, y: 0, w: 10, h: 10}, parseTransform('rotate(45)'));
  near(c.w, 10 * Math.SQRT2, 1e-9);
  assert.equal(corners({x: 1, y: 2, w: 3, h: 4}).length, 4);
});

// ---- paths ----

test('flattenPath: lines, H, V, relative commands, close, and a new subpath', () => {
  const [a, b] = flattenPath('M10 10 L20 10 H30 V30 l-5 5 z M50 50 h10');
  assert.deepEqual(a.pts, [[10, 10], [20, 10], [30, 10], [30, 30], [25, 35]]);
  assert.equal(a.closed, true);
  assert.deepEqual(b.pts, [[50, 50], [60, 50]]);
  assert.equal(b.closed, false);
});

test('flattenPath: a number list after a command repeats it; after M it means L', () => {
  const [a] = flattenPath('M0 0 10 0 10 10 L 20 20 30 30');
  assert.deepEqual(a.pts, [[0, 0], [10, 0], [10, 10], [20, 20], [30, 30]]);
  const [r] = flattenPath('m1 1 2 0 0 2');
  assert.deepEqual(r.pts, [[1, 1], [3, 1], [3, 3]]);
});

test('flattenPath: compact numbers: signs and decimals as separators, exponents', () => {
  assert.deepEqual(flattenPath('M10-5L-3.5.5')[0].pts, [[10, -5], [-3.5, 0.5]]);
  assert.deepEqual(flattenPath('M1e1,2E0L0 0')[0].pts, [[10, 2], [0, 0]]);
});

test('flattenPath: after z the next command starts at the start of the closed subpath', () => {
  const sub = flattenPath('M10 10 L20 10 L20 20 z l5 5');
  assert.equal(sub.length, 2);
  assert.deepEqual(sub[1].pts[0], [10, 10]);
  assert.deepEqual(sub[1].pts[1], [15, 15]);
});

test('flattenPath: a cubic ends where it should and bulges where it should', () => {
  const [c] = flattenPath('M0 0 C 0 100, 100 100, 100 0');
  assert.deepEqual(c.pts[0], [0, 0]);
  nearPt(c.pts[c.pts.length - 1], 100, 0);
  assert.ok(c.pts.length > 10);
  near(Math.max(...c.pts.map(p => p[1])), 75, 0.5);
  assert.deepEqual(c.extrema.map(p => [+p[0].toFixed(3), +p[1].toFixed(3)]).sort(), [[50, 75]]);
});

test('flattenPath: the exact extreme of a curve is reported, so its box is not the flattening\'s', () => {
  const o = outlineOf(el('<path id="e" d="M150 100 C 180 60, 220 60, 250 100"/>'), VP);
  near(o.box!.y, 70, 1e-9);
  near(o.box!.h, 30, 1e-9);
  assert.deepEqual([o.box!.x, o.box!.w], [150, 100]);
});

test('flattenPath: S and T reflect the previous control point; Q works', () => {
  const [s] = flattenPath('M0 0 C 10 0, 20 10, 30 10 S 50 20, 60 10');
  nearPt(s.pts[s.pts.length - 1], 60, 10);
  const [t] = flattenPath('M0 0 Q 10 20, 20 0 T 40 0');
  nearPt(t.pts[t.pts.length - 1], 40, 0);
  assert.ok(Math.min(...t.pts.map(p => p[1])) < -5, 'the T reflected the control point, bulging the other way');
  assert.ok(Math.max(...t.pts.map(p => p[1])) > 5);
});

test('flattenPath: an arc ends at its end point and stays on its circle', () => {
  const [a] = flattenPath('M0 0 A 50 50 0 0 1 100 0');
  nearPt(a.pts[a.pts.length - 1], 100, 0);
  for (const p of a.pts) near(Math.hypot(p[0] - 50, p[1]), 50, 1e-6);
  assert.ok(a.pts.every(p => p[1] <= 1e-9), 'sweep 1 from left to right goes up in screen coordinates (y negative)');
});

test('flattenPath: arc flags may be written without separators; large-arc and sweep choose among the four arcs', () => {
  const compact = flattenPath('M0 0a50 50 0 0150 50')[0].pts;
  nearPt(compact[compact.length - 1], 50, 50);
  const ys = (la: number, sw: number) => flattenPath(`M0 0 A 50 50 0 ${la} ${sw} 60 0`)[0].pts.map(p => p[1]);
  assert.ok(Math.min(...ys(0, 1)) < -1 && Math.max(...ys(0, 1)) <= 1e-9);
  assert.ok(Math.max(...ys(0, 0)) > 1 && Math.min(...ys(0, 0)) >= -1e-9);
  assert.ok(Math.abs(Math.min(...ys(1, 1))) > Math.abs(Math.min(...ys(0, 1))));
});

test('flattenPath: an arc too small for its endpoints is scaled up; a zero radius is a line', () => {
  const [a] = flattenPath('M0 0 A 1 1 0 0 1 100 0');
  nearPt(a.pts[a.pts.length - 1], 100, 0);
  assert.deepEqual(flattenPath('M0 0 A 0 5 0 0 1 10 10')[0].pts, [[0, 0], [10, 10]]);
});

test('flattenPath refuses malformed data, saying where', () => {
  assert.throws(() => flattenPath('M 10'), /number was expected/);
  assert.throws(() => flattenPath('M0 0 X 5'), /unknown command|unexpected/);
  assert.throws(() => flattenPath('M0 0 A 5 5 0 2 0 10 10'), /arc flag/);
  assert.deepEqual(flattenPath(''), []);
  assert.deepEqual(flattenPath('   '), []);
});

// ---- shapes ----

test('outlineOf: rect, with percentages of the viewport', () => {
  assert.deepEqual(outlineOf(el('<rect id="e" x="10" y="20" width="30" height="40"/>'), VP).box, {x: 10, y: 20, w: 30, h: 40});
  assert.deepEqual(outlineOf(el('<rect id="e" width="100%" height="50%"/>'), VP).box, {x: 0, y: 0, w: 400, h: 100});
  assert.deepEqual(outlineOf(el('<rect id="e" x="5px" width="10px" height="1"/>'), VP).box, {x: 5, y: 0, w: 10, h: 1});
  assert.deepEqual(outlineOf(el('<rect id="e"/>'), VP).box, {x: 0, y: 0, w: 0, h: 0});
});

test('outlineOf: circle and ellipse have the exact box, and the outline closes', () => {
  const c = outlineOf(el('<circle id="e" cx="100" cy="50" r="20"/>'), VP);
  for (const [k, v] of Object.entries({x: 80, y: 30, w: 40, h: 40})) near((c.box as any)[k], v, 1e-9);
  assert.deepEqual(c.polylines[0][0].map(v => +v.toFixed(6)), c.polylines[0][c.polylines[0].length - 1].map(v => +v.toFixed(6)));
  const e = outlineOf(el('<ellipse id="e" cx="10" cy="10" rx="5" ry="2"/>'), VP);
  for (const [k, v] of Object.entries({x: 5, y: 8, w: 10, h: 4})) near((e.box as any)[k], v, 1e-9);
});

test('outlineOf: line, polyline, polygon', () => {
  assert.deepEqual(outlineOf(el('<line id="e" x1="1" y1="2" x2="11" y2="5"/>'), VP).box, {x: 1, y: 2, w: 10, h: 3});
  assert.deepEqual(outlineOf(el('<polyline id="e" points="0,0 10,5 20,0"/>'), VP).box, {x: 0, y: 0, w: 20, h: 5});
  const pg = outlineOf(el('<polygon id="e" points="0 0 10 0 10 10"/>'), VP);
  assert.deepEqual(pg.box, {x: 0, y: 0, w: 10, h: 10});
  assert.deepEqual(pg.polylines[0][0], pg.polylines[0][pg.polylines[0].length - 1], 'a polygon closes');
  assert.deepEqual(outlineOf(el('<polygon id="e" points=""/>'), VP), {polylines: [], box: null, points: []});
});

test('outlineOf: a path\'s box covers every subpath, and an empty path has none', () => {
  assert.deepEqual(outlineOf(el('<path id="e" d="M0 0 L10 10 M50 5 L60 8"/>'), VP).box, {x: 0, y: 0, w: 60, h: 10});
  assert.equal(outlineOf(el('<path id="e" d=""/>'), VP).box, null);
});

test('isShape names the drawable shapes, and not text or groups', () => {
  for (const t of ['rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'path']) assert.ok(isShape({tag: t} as El), t);
  for (const t of ['text', 'g', 'svg', 'tspan', 'use']) assert.ok(!isShape({tag: t} as El), t);
});

// ---- walking along an outline ----

test('sampleAlong: points every step along a line, and its end', () => {
  const pts = sampleAlong([[0, 0], [10, 0]], 3);
  assert.deepEqual(pts, [[0, 0], [3, 0], [6, 0], [9, 0], [10, 0]]);
});

test('sampleAlong: the spacing carries over a corner; a single point and an empty line are handled', () => {
  const pts = sampleAlong([[0, 0], [4, 0], [4, 4]], 3);
  assert.deepEqual(pts.slice(0, 3), [[0, 0], [3, 0], [4, 2]]);
  assert.deepEqual(sampleAlong([[5, 5]], 3), [[5, 5]]);
  assert.deepEqual(sampleAlong([], 3), []);
});

// ---- fonts ----

test('familyKind: the first family of the list decides', () => {
  assert.equal(familyKind("'Hiragino Sans','Yu Gothic',sans-serif"), 'sans');
  assert.equal(familyKind("'JetBrains Mono',monospace"), 'mono');
  assert.equal(familyKind('monospace'), 'mono');
  assert.equal(familyKind("Consolas, 'Liberation Mono'"), 'mono');
  assert.equal(familyKind("'Noto Color Emoji','Segoe UI Emoji',sans-serif"), 'emoji');
  assert.equal(familyKind('serif'), 'sans');
  assert.equal(familyKind(''), 'sans');
});

// ---- text boxes ----

const STYLE = `<style>text { font-family: 'Hiragino Sans','Hiragino Kaku Gothic ProN','Yu Gothic','YuGothic',Meiryo,'Noto Sans JP',sans-serif; }</style>`;
const boxOfText = (inner: string, attrs = '') => {
  const r = root(`${STYLE}<text id="e" ${attrs}>${inner}</text>`);
  return textBoxOf(elements(r).find(e => e.attrs.id === 'e')!, computeStyles(r));
};
const sans = (text: string, size: number, weight = 400) => textBox(text, 'sans', size, weight);
const skip = haveFont ? false : 'no font file found';

test('a text\'s box is its advance wide, and from ascent above the baseline to descent below', {skip}, () => {
  const b = boxOfText('Inventory', 'x="20" y="120" font-size="16" fill="#000"')!;
  const t = sans('Inventory', 16);
  near(b.x, 20); near(b.w, t.w); near(b.y, 120 - t.ascent); near(b.h, t.ascent + t.descent);
});

test('text-anchor moves the box: middle by half the width, end by all of it', {skip}, () => {
  const w = sans('Dash', 20).w;
  near(boxOfText('Dash', 'x="300" y="50" font-size="20" text-anchor="middle"')!.x, 300 - w / 2);
  near(boxOfText('Dash', 'x="300" y="50" font-size="20" text-anchor="end"')!.x, 300 - w);
  near(boxOfText('Dash', 'x="300" y="50" font-size="20" text-anchor="start"')!.x, 300);
});

test('the size and weight come from the cascade, and bold is wider', {skip}, () => {
  const regular = boxOfText('Inventory management', 'x="0" y="50" font-size="16"')!, bold = boxOfText('Inventory management', 'x="0" y="50" font-size="16" font-weight="700"')!;
  assert.ok(bold.w >= regular.w);
  near(boxOfText('Inventory', 'x="0" y="50" font-size="32"')!.w, 2 * sans('Inventory', 16).w, 1e-6);
});

test('a tspan with its own weight is measured with it; the runs are laid end to end', {skip}, () => {
  const b = boxOfText('A <tspan font-weight="700">bold</tspan> word', 'x="10" y="50" font-size="18"')!;
  near(b.w, sans('A ', 18).w + sans('bold', 18, 700).w + sans(' word', 18).w, 1e-6);
});

test('a tspan with x starts a new line, anchored on its own; dy moves down; the box is the union', {skip}, () => {
  const b = boxOfText('<tspan x="20" dy="0">line one</tspan><tspan x="20" dy="22">second line here</tspan>', 'x="20" y="50" font-size="18"')!;
  const t = sans('second line here', 18);
  near(b.w, t.w); near(b.x, 20);
  near(b.y, 50 - t.ascent); near(b.h, 22 + t.ascent + t.descent);
});

test('a tspan with dx continues on the same line, shifted', {skip}, () => {
  const b = boxOfText('ab<tspan dx="10">cd</tspan>', 'x="0" y="50" font-size="16"')!;
  near(b.w, sans('ab', 16).w + 10 + sans('cd', 16).w, 1e-6);
});

test('whitespace collapses as in SVG unless xml:space="preserve"', {skip}, () => {
  const collapsed = boxOfText('  a    b  \n  c  ', 'x="0" y="50" font-size="16"')!;
  near(collapsed.w, sans('a b c', 16).w, 1e-6);
  const kept = boxOfText('a  b', 'x="0" y="50" font-size="16" xml:space="preserve"')!;
  near(kept.w, sans('a  b', 16).w, 1e-6);
  const nl = boxOfText('a\nb', 'x="0" y="50" font-size="16" xml:space="preserve"')!;
  near(nl.w, sans('a b', 16).w, 1e-6);
});

test('a text with no characters, or only spaces, draws nothing', {skip}, () => {
  assert.equal(boxOfText('', 'x="0" y="50" font-size="16"'), null);
  assert.equal(boxOfText('    ', 'x="0" y="50" font-size="16"'), null);
  assert.equal(boxOfText('<tspan></tspan>', 'x="0" y="50" font-size="16"'), null);
});

test('x and y default to 0, dx and dy of the text shift it, and a list takes its first value', {skip}, () => {
  const t = sans('a', 16);
  const b0 = boxOfText('a', 'font-size="16"')!;
  near(b0.x, 0); near(b0.y, -t.ascent);
  const b1 = boxOfText('a', 'x="5" y="30" dx="2" dy="3" font-size="16"')!;
  near(b1.x, 7); near(b1.y, 33 - t.ascent);
  near(boxOfText('abc', 'x="5 10 15" y="30" font-size="16"')!.x, 5);
});

test('Japanese text is one em per character', {skip}, () => {
  near(boxOfText('在庫管理', 'x="0" y="50" font-size="20"')!.w, 80, 0.01);
});

test('a tspan with only an x starts a new chunk there; each chunk is anchored on its own', {skip}, () => {
  const b = boxOfText('ab<tspan x="100">cd</tspan>', 'x="0" y="50" font-size="16"')!;
  near(b.x, 0);
  near(b.w, 100 + sans('cd', 16).w, 1e-6);
  const mid = boxOfText('ab<tspan x="200">cd</tspan>', 'x="100" y="50" font-size="16" text-anchor="middle"')!;
  near(mid.x, 100 - sans('ab', 16).w / 2, 1e-6);
  near(mid.x + mid.w, 200 + sans('cd', 16).w / 2, 1e-6);
});

test('a tspan with only a y moves to that baseline', {skip}, () => {
  const t = sans('ab', 16);
  const b = boxOfText('ab<tspan y="90">cd</tspan>', 'x="0" y="50" font-size="16"')!;
  near(b.y, 50 - t.ascent, 1e-6);
  near(b.y + b.h, 90 + t.descent, 1e-6);
});
