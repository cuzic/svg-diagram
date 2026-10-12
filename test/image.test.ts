// image(): a picture embedded as a data URI, with marks and label plates over it; how the checks, spotlight, reveal, --html and the
// raster path treat it.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {box, caption, checkDiagram, closeMeasurer, connect, diagram, group, image, renderDiagram, row} from '../lib/dsl.ts';
import {emitSvg} from '../lib/emit.ts';
import {lintDiagram} from '../lib/rules.ts';
import {readImage, sniffImage, withSourceDir, IMAGE_WARN_BYTES} from '../lib/image.ts';
import {geometryChecks} from '../lib/svg-lint.ts';
import {rasterize} from '../lib/raster.ts';
import {kitchenPng, makePng} from './helpers/png.ts';

process.env.SVG_DIAGRAM_STRICT_WIDTH = '1';
test.after(() => closeMeasurer());

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'image-test-'));
const kitchen = path.join(dir, 'kitchen.png');
fs.writeFileSync(kitchen, kitchenPng()); // 240 x 160
const MARKS = [
  {id: 'pot', rect: [0.16, 0.42, 0.24, 0.3], tone: 'danger', label: '火の元'},
  {id: 'window', rect: [0.62, 0.12, 0.3, 0.38], label: '窓'},
] as const;

test('sniffImage reads the size of PNG, GIF, JPEG and WebP headers, and nothing else', () => {
  assert.deepEqual(sniffImage(makePng(7, 5)), {mime: 'image/png', w: 7, h: 5});
  const gif = Buffer.alloc(16); gif.write('GIF89a', 0, 'latin1'); gif.writeUInt16LE(30, 6); gif.writeUInt16LE(20, 8);
  assert.deepEqual(sniffImage(gif), {mime: 'image/gif', w: 30, h: 20});
  // SOI, an APP0 segment, then SOF0 (height 40, width 60)
  const jpg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x28, 0x00, 0x3c, 0x01, 0x01, 0x11, 0x00]);
  assert.deepEqual(sniffImage(jpg), {mime: 'image/jpeg', w: 60, h: 40});
  const webp = Buffer.alloc(40); webp.write('RIFF', 0, 'latin1'); webp.write('WEBP', 8, 'latin1'); webp.write('VP8X', 12, 'latin1'); webp.writeUIntLE(99, 24, 3); webp.writeUIntLE(49, 27, 3);
  assert.deepEqual(sniffImage(webp), {mime: 'image/webp', w: 100, h: 50});
  assert.equal(sniffImage(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>')), null);
  assert.equal(sniffImage(Buffer.from('just text, long enough to pass the length checks')), null);
});

test('readImage embeds the file; a path, a file URL and a data URI give the same bytes; a relative path follows the source', () => {
  const a = readImage(kitchen), b = readImage(new URL(`file://${kitchen}`)), c = readImage(a.href);
  assert.match(a.href, /^data:image\/png;base64,/);
  assert.equal(a.w, 240); assert.equal(a.h, 160);
  assert.equal(a.href, b.href); assert.equal(a.href, c.href);
  assert.equal(withSourceDir(dir, () => readImage('./kitchen.png')).href, a.href);
  assert.equal(crypto.createHash('sha1').update(Buffer.from(a.href.split(',')[1], 'base64')).digest('hex'), crypto.createHash('sha1').update(fs.readFileSync(kitchen)).digest('hex'));
});

test('image() refuses what it cannot embed or describe', () => {
  const svgFile = path.join(dir, 'a.svg'); fs.writeFileSync(svgFile, '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>');
  assert.throws(() => image(svgFile, {alt: 'x'}), /only PNG, JPEG, GIF and WebP/);
  assert.throws(() => image(path.join(dir, 'missing.png'), {alt: 'x'}), /cannot read/);
  assert.throws(() => image(kitchen, {}), /alt is required/);
  assert.throws(() => image(kitchen, {alt: 'x', decorative: true}), /contradict/);
  assert.throws(() => image(kitchen, {alt: 'x', width: 100, height: 100}), /width or height, not both/);
  assert.throws(() => image(kitchen, {alt: 'x', marks: [{rect: [0.5, 0.5, 0.6, 0.2]}]}), /inside it/);
  assert.throws(() => image(kitchen, {alt: 'x', labels: [{text: 'a', at: [2, 0]}]}), /fractions/);
  assert.throws(() => image(kitchen, {alt: 'x', marks: [{id: 'a', rect: [0, 0, 0.1, 0.1]}, {id: 'a', rect: [0.5, 0.5, 0.1, 0.1]}]}), /unique/);
  assert.throws(() => image('data:image/png;base64,@@@', {alt: 'x'}), /data URI/);
  assert.doesNotThrow(() => image(kitchen, {decorative: true}));
});

test('the picture keeps its aspect ratio, is centred, and never wider than the content', async () => {
  const lay = async (opts: object) => (await checkDiagram(diagram({theme: 'blue'}).add(image(kitchen, {alt: 'x', ...opts})))).laidOut.laidOut.find(b => b.type === 'image')!;
  const full = await lay({}), narrow = await lay({width: 240}), tall = await lay({height: 80}), wide = await lay({height: 4000});
  assert.equal(full.w, 940 - 2 * 20 > 0 ? full.w : 0);
  assert.ok(Math.abs(full.w / full.h - 1.5) < 0.02);
  assert.equal(narrow.w, 240); assert.equal(narrow.h, 160);
  assert.equal(narrow.x, Math.round((940 - 240) / 2), 'centred');
  assert.equal(tall.h, 80); assert.equal(tall.w, 120);
  assert.ok(wide.w <= 940, 'a height that would overflow is capped by the width');
});

test('the SVG is self-contained: the file is inside, with an accessible name, marks and opaque plates', async () => {
  const d = diagram({theme: 'blue', title: '台所'}).add(image(kitchen, {id: 'k', alt: '台所の絵', width: 480, marks: [...MARKS], labels: [{text: '台所', at: [0.02, 0.06], tone: 'solid'}]}));
  const r = await renderDiagram(d, {name: 'k.svg', budget: 'cacheOnly'});
  assert.deepEqual(r.verdict.problems, []);
  assert.match(r.svg, /<image [^>]*href="data:image\/png;base64,/);
  assert.match(r.svg, /role="img" aria-label="台所の絵"/);
  assert.doesNotMatch(r.svg, /href="(?!data:)[^"]/);
  assert.match(r.svg, /画像: 台所の絵/, 'the alt text is part of the SVG description');
  // every label is a text on an opaque rect painted just before it
  const texts = [...r.svg.matchAll(/<rect [^>]*fill="(#[0-9a-f]{6})"[^>]*\/>\s*<text [^>]*>([^<]+)</g)];
  assert.deepEqual(texts.map(t => t[2]).sort(), ['台所', '火の元', '窓']);
});

test('the lint finds no contrast problem on plates, and flags a text on the bare picture', async () => {
  const d = diagram({theme: 'blue'}).add(image(kitchen, {alt: 'x', width: 480, marks: [...MARKS], labels: [{text: '台所', at: [0.02, 0.06]}]}));
  const {svg} = await renderDiagram(d, {name: 'k.svg', budget: 'cacheOnly'});
  assert.deepEqual(geometryChecks(svg)!.contrast, []);
  // the same figure with the plates taken away: the words sit on pixels nobody can check
  const bare = svg.replace(/<rect [^>]*rx="[\d.]+"[^>]*\/>(\s*<text)/g, '$1');
  const found = geometryChecks(bare)!.contrast;
  assert.deepEqual(found.map(f => f.txt).sort(), ['台所', '火の元', '窓']);
  assert.match(found[0].bg, /image/);
  // a plate that does not hold the whole text is no plate
  const small = svg.replace(/width="\d+"(?= height="\d+" rx=)/g, 'width="6"');
  assert.ok(geometryChecks(small)!.contrast.length > 0);
});

test('a mark is a connect() endpoint and a connector may start inside its own picture', async () => {
  const k = image(kitchen, {alt: 'x', width: 480, marks: [...MARKS]});
  const {laidOut, verdict} = await checkDiagram(diagram({theme: 'blue'}).add(k, row([box({id: 'n', title: '見る所'})]), connect(k.anchors.pot.bottom, 'n:top')));
  assert.deepEqual(verdict.problems, []);
  const img = laidOut.laidOut.find(b => b.type === 'image')!;
  assert.deepEqual(img.type === 'image' && img.anchors.map(a => a.id), ['pot', 'window']);
  assert.equal(laidOut.connects.length, 1);
  // an id that another part already has is refused
  await assert.rejects(checkDiagram(diagram({theme: 'blue'}).add(box({id: 'pot', title: 'x'}), image(kitchen, {alt: 'x', marks: [...MARKS]}))), /pot/);
});

test('labels that overlap, or that are too wide for the picture, fail verification', async () => {
  const two = (a: number, b: number) => checkDiagram(diagram({theme: 'blue'}).add(image(kitchen, {alt: 'x', width: 300, labels: [{text: '一つ目', at: [a, 0.5]}, {text: '二つ目', at: [b, 0.5]}]})));
  assert.deepEqual((await two(0.05, 0.6)).verdict.problems, []);
  assert.match((await two(0.05, 0.1)).verdict.problems.join('\n'), /overlaps label/);
  const tooLong = await checkDiagram(diagram({theme: 'blue'}).add(image(kitchen, {alt: 'x', width: 100, labels: [{text: 'とてもながいことばがここにはいります', at: [0, 0.5]}]})));
  assert.match(tooLong.verdict.problems.join('\n'), /does not fit inside the picture/);
});

test('spotlight on a mark keeps its region clear of a veil; on other things it veils the whole picture', async () => {
  const make = (spotlight: string) => diagram({theme: 'blue', spotlight}).add(image(kitchen, {id: 'k', alt: 'x', width: 480, marks: [...MARKS]}), box({id: 'other', title: 'その他'}));
  const focused = (await checkDiagram(make('pot'))).laidOut.laidOut.find(b => b.type === 'image')!;
  assert.equal(focused.type === 'image' && focused.holes?.length, 1);
  assert.deepEqual(focused.type === 'image' && focused.marks.map(m => m.dim), [false, true]);
  assert.equal(focused.dim, undefined);
  const svg = emitSvg((await checkDiagram(make('pot'))).laidOut);
  assert.match(svg, /fill-rule="evenodd"/);
  assert.match(svg, /stroke-dasharray="2,5"/, 'the other mark is dotted');
  const away = (await checkDiagram(make('other'))).laidOut.laidOut.find(b => b.type === 'image')!;
  assert.equal(away.dim, true);
  const whole = (await checkDiagram(make('k'))).laidOut.laidOut.find(b => b.type === 'image')!;
  assert.equal(whole.dim, false, 'the picture itself is the spotlight: nothing dims');
});

test('reveal: a mark and a plate appear at their stage, and a connector follows its mark', async () => {
  const k = image(kitchen, {alt: 'x', width: 480, marks: [{id: 'pot', rect: [0.16, 0.42, 0.24, 0.3], label: '火の元', reveal: 2}], labels: [{text: '台所', at: [0.02, 0.06], reveal: 1}]});
  const d = diagram({theme: 'blue'}).add(k, row([box({id: 'n', title: 'n'})]), connect(k.anchors.pot.bottom, 'n:top'));
  const {laidOut} = await checkDiagram(d);
  assert.equal(laidOut.connects[0].reveal, 2);
  const at = (n: number) => emitSvg(laidOut, {reveal: n});
  assert.doesNotMatch(at(0), /台所|火の元/);
  assert.match(at(1), /台所/); assert.doesNotMatch(at(1), /火の元/);
  assert.match(at(2), /火の元/);
});

test('a group with a reveal carries its picture', async () => {
  const d = diagram({theme: 'blue'}).add(group([image(kitchen, {alt: 'x', width: 300})], {title: 'g', reveal: 1}));
  const {laidOut} = await checkDiagram(d);
  assert.doesNotMatch(emitSvg(laidOut, {reveal: 0}), /<image/);
  assert.match(emitSvg(laidOut, {reveal: 1}), /<image/);
});

test('image-large warns for a big file; a small one is quiet', async () => {
  const noise = path.join(dir, 'noise.png');
  fs.writeFileSync(noise, makePng(400, 300, () => [...crypto.randomBytes(3)] as [number, number, number])); // noise does not compress
  assert.ok(fs.statSync(noise).size > IMAGE_WARN_BYTES);
  const rules = (src: string) => { const d = diagram({theme: 'blue', title: 't'}); d.add(image(src, {alt: 'x'})); return lintDiagram({...d, laidOut: [], connects: []}).map(f => f.rule); };
  assert.ok(rules(noise).includes('image-large'));
  assert.ok(!rules(kitchen).includes('image-large'));
});

test('--html: the picture is an inline SVG image, the plates are boxes, the words are HTML', async () => {
  const d = diagram({theme: 'blue'}).add(image(kitchen, {alt: '台所の絵', width: 480, marks: [...MARKS]}), caption('下'));
  const {html} = await renderDiagram(d, {name: 'k.svg', budget: 'cacheOnly', html: true});
  assert.match(html!, /<image [^>]*href="data:image\/png;base64,/);
  assert.match(html!, /aria-label="台所の絵"/);
  assert.match(html!, /class="sd-t[^"]*"[^>]*>火の元</);
  assert.doesNotMatch(html!, /<text/);
  assert.ok(html!.indexOf('<image') < html!.indexOf('>火の元<'), 'the picture is under its words');
});

test('raster: resvg draws the embedded picture, with the plate over it', async () => {
  const d = diagram({theme: 'blue'}).add(image(kitchen, {alt: 'x', width: 240, marks: [], labels: [{text: '台所', at: [0.02, 0.05], tone: 'solid'}]}));
  const {svg, laidOut} = await renderDiagram(d, {name: 'k.svg', budget: 'cacheOnly'});
  const img = laidOut.laidOut.find(b => b.type === 'image')!;
  const r = await rasterize(svg, {engine: 'resvg'});
  const px = (x: number, y: number) => [...r.rgba.subarray(4 * (Math.round(y) * r.width + Math.round(x)), 4 * (Math.round(y) * r.width + Math.round(x)) + 3)];
  // the wall (235,228,210) near the top-right, the counter (90,70,50) at the bottom; the file's colours, not white
  const near = (a: number[], b: number[]) => a.every((v, i) => Math.abs(v - b[i]) < 6);
  assert.ok(near(px(img.x + img.w - 6, img.y + 6), [235, 228, 210]), `wall: ${px(img.x + img.w - 6, img.y + 6)}`);
  assert.ok(near(px(img.x + 6, img.y + img.h - 6), [90, 70, 50]), `counter: ${px(img.x + 6, img.y + img.h - 6)}`);
  // the solid plate (the theme's accent) sits over the top-left of the picture
  assert.ok(!near(px(img.x + 14, img.y + 14), [235, 228, 210]));
});
