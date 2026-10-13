// lib/contact.ts and the `contact`, `preview` and `show` commands, run without a browser.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {buildSheet, paginate, pageName} from '../lib/contact.ts';
import {rasterize, svgSize} from '../lib/raster.ts';
import {resolveFontFile} from '../lib/font-metrics.ts';

const ROOT = path.resolve(import.meta.dirname, '..');
const BIN = path.join(ROOT, 'bin', 'svg-diagram');
const BLOCK = pathToFileURL(path.join(import.meta.dirname, 'helpers', 'block-playwright-register.ts')).href;
const haveFont = resolveFontFile('sans') !== null;
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'contact-'));
// no browser can be started in these runs: the commands must not need one
const run = (cwd: string, ...args: string[]) => spawnSync(BIN, args, {cwd, encoding: 'utf8', env: {...process.env, NODE_OPTIONS: `--import ${BLOCK}`}});
const out = (r: ReturnType<typeof run>) => `${r.stdout}\n${r.stderr}`;
const NO_BROWSER = /playwright-chromium is not installed/;
const png = (f: string) => { const b = fs.readFileSync(f); return {sig: b.subarray(1, 4).toString(), w: b.readUInt32BE(16), h: b.readUInt32BE(20)}; };
const figure = (w: number, h: number, body = '') => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="100%" height="100%" fill="#ffffff"/>${body}</svg>`;
const BIG_TEXT = figure(300, 100, '<text x="10" y="70" font-size="48" fill="#000000">在庫A</text>');
const darkIn = (r: {width: number; rgba: Buffer}, x0: number, y0: number, x1: number, y1: number) => {
  let n = 0;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const i = 4 * (y * r.width + x); if (r.rgba[i] < 128 && r.rgba[i + 1] < 128) n++; }
  return n;
};

test('the sheet is as wide as asked and tall enough for its rows; cols changes the layout', () => {
  const figs: [string, string][] = [['a.svg', figure(200, 100)], ['b.svg', figure(200, 100)], ['c.svg', figure(200, 100)], ['d.svg', figure(200, 100)]];
  const one = buildSheet(figs, {cols: 1, width: 800}), two = buildSheet(figs, {cols: 2, width: 800}), four = buildSheet(figs, {cols: 4, width: 800});
  for (const s of [one, two, four]) { assert.equal(s.width, 800); assert.deepEqual(svgSize(s.svg), {w: 800, h: s.height}); }
  assert.ok(one.height > two.height && two.height > four.height, `${one.height} ${two.height} ${four.height}`);
  assert.ok(four.height < 200, 'one row of four');
});

test('each figure keeps its aspect ratio and a short one does not stretch its row', () => {
  const s = buildSheet([['wide.svg', figure(400, 100)], ['tall.svg', figure(100, 400)]], {cols: 2, width: 1000});
  const heights = [...s.svg.matchAll(/<svg [^>]*?\sx="[^"]+" y="[^"]+" width="([\d.]+)" height="([\d.]+)"/g)].map(m => [+m[1], +m[2]]);
  assert.equal(heights.length, 2);
  assert.ok(Math.abs(heights[0][0] / heights[0][1] - 4) < 0.05);
  assert.ok(Math.abs(heights[1][0] / heights[1][1] - 0.25) < 0.05);
});

test('captions are the file names, escaped', () => {
  const s = buildSheet([['dir/a&b <1>.svg', figure(10, 10)]]);
  assert.match(s.svg, />a&amp;b &lt;1>\.svg</);
});

test('a figure without a size, or a width too small for the columns, is refused with the reason', () => {
  assert.throws(() => buildSheet([['x.svg', '<svg xmlns="http://www.w3.org/2000/svg"/>']]), /x\.svg: no width\/height/);
  assert.throws(() => buildSheet([['x.svg', figure(10, 10)]], {cols: 8, width: 100}), /too narrow/);
});

test('ids are not shared between the figures on a sheet', () => {
  const withId = figure(20, 20, '<defs><marker id="arrow"/></defs><path marker-end="url(#arrow)" d="M0 0"/>');
  const s = buildSheet([['a.svg', withId], ['b.svg', withId]]);
  const ids = [...s.svg.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]);
  assert.equal(ids.length, 2);
  assert.equal(new Set(ids).size, 2);
});

test('an empty sheet is just the margin', () => {
  const s = buildSheet([], {width: 500});
  assert.equal(s.height, 32);
});

test('the text of a figure is drawn on the sheet', {skip: haveFont ? false : 'no font file found'}, async () => {
  const s = buildSheet([['t.svg', BIG_TEXT]], {cols: 1, width: 700});
  const r = await rasterize(s.svg);
  // the figure's area (below the caption) must contain dark glyph pixels
  assert.ok(darkIn(r, 24, 46, 676, s.height - 24) > 300);
});

test('contact: writes a PNG of the right width, with no browser available', () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, 'a.svg'), figure(200, 100));
  fs.writeFileSync(path.join(dir, 'b.svg'), figure(200, 150));
  const r = run(dir, 'contact', 'a.svg', 'b.svg', '--out', 'sheet.png', '--width', '900', '--cols', '2');
  assert.equal(r.status, 0, out(r));
  assert.match(r.stdout, /wrote sheet\.png \(2 diagrams\)/);
  const p = png(path.join(dir, 'sheet.png'));
  assert.deepEqual([p.sig, p.w], ['PNG', 900]);
  assert.ok(p.h > 100);
  fs.rmSync(dir, {recursive: true});
});

test('contact: usage errors exit 2, a figure it cannot read exits 1', () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, 'a.svg'), figure(20, 20));
  fs.writeFileSync(path.join(dir, 'nosize.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>');
  assert.equal(run(dir, 'contact').status, 2);
  assert.equal(run(dir, 'contact', 'a.svg', '--engine', 'netscape').status, 2);
  assert.equal(run(dir, 'contact', 'a.svg', '--width', '-5').status, 2);
  assert.equal(run(dir, 'contact', 'a.svg', '--bogus').status, 2);
  const bad = run(dir, 'contact', 'nosize.svg', '--out', 'x.png');
  assert.equal(bad.status, 1);
  assert.match(out(bad), /nosize\.svg: no width\/height/);
  assert.equal(fs.existsSync(path.join(dir, 'x.png')), false);
  fs.rmSync(dir, {recursive: true});
});

test('preview: a PNG at scale 2 by default, at the scale given otherwise, with no browser available', () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, 'a.svg'), figure(120, 80));
  const two = run(dir, 'preview', 'a.svg', 'two.png');
  assert.equal(two.status, 0, out(two));
  assert.match(two.stdout, /wrote two\.png \(240x160\)/);
  assert.deepEqual([png(path.join(dir, 'two.png')).w, png(path.join(dir, 'two.png')).h], [240, 160]);
  const half = run(dir, 'preview', 'a.svg', 'half.png', '0.5');
  assert.equal(half.status, 0, out(half));
  assert.deepEqual([png(path.join(dir, 'half.png')).w, png(path.join(dir, 'half.png')).h], [60, 40]);
  fs.rmSync(dir, {recursive: true});
});

test('preview: usage errors exit 2; a missing or malformed file exits 1 and names the file', () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, 'broken.svg'), figure(10, 10, '<g>'));
  assert.equal(run(dir, 'preview').status, 2);
  assert.equal(run(dir, 'preview', 'a.svg').status, 2);
  assert.equal(run(dir, 'preview', 'a.svg', 'o.png', '0').status, 2);
  assert.equal(run(dir, 'preview', 'a.svg', 'o.png', '--engine', 'nope').status, 2);
  const missing = run(dir, 'preview', 'nope.svg', 'o.png');
  assert.equal(missing.status, 1);
  assert.match(out(missing), /nope\.svg/);
  const broken = run(dir, 'preview', 'broken.svg', 'o.png');
  assert.equal(broken.status, 1);
  assert.match(out(broken), /broken\.svg: could not load it as an <img>/);
  fs.rmSync(dir, {recursive: true});
});

test('show --png: draws a source and a file, with no browser available; a bad --engine is a usage error', () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, 'a.svg'), figure(100, 60));
  const svg = run(dir, 'show', 'a.svg', '--png', 'a.png');
  assert.equal(svg.status, 0, out(svg));
  assert.deepEqual([png(path.join(dir, 'a.png')).w, png(path.join(dir, 'a.png')).h], [100, 60]);
  const src = run(ROOT, 'show', 'examples/inventory-flow.ts', '--png', path.join(dir, 'f.png'));
  assert.equal(src.status, 0, out(src));
  assert.equal(png(path.join(dir, 'f.png')).w, 940);
  const bad = run(dir, 'show', 'a.svg', '--png', 'b.png', '--engine', 'nope');
  assert.equal(bad.status, 2);
  assert.match(out(bad), /--engine is resvg or chromium/);
  fs.rmSync(dir, {recursive: true});
});

test('the usage text lists contact, preview and show with their options', () => {
  const r = spawnSync(BIN, [], {encoding: 'utf8'});
  assert.match(out(r), /contact a\.svg b\.svg/);
  assert.match(out(r), /preview <in\.svg> \[out\.png\]/);
  assert.match(out(r), /show <file\.svg\|file\.ts>.*--engine/);
});

test('the shell script that needed Chrome is gone', () => {
  assert.equal(fs.existsSync(path.join(ROOT, 'preview_svg.sh')), false);
});

test('--engine chromium reaches the renderer in contact, preview and show: with no browser available each says how to get one', () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, 'a.svg'), figure(40, 30));
  for (const args of [['contact', 'a.svg', '--out', 'c.png', '--engine', 'chromium'], ['preview', 'a.svg', 'p.png', '--engine', 'chromium'], ['show', 'a.svg', '--png', 's.png', '--engine', 'chromium']]) {
    const r = run(dir, ...args);
    assert.equal(r.status, 1, `${args[0]}: ${out(r)}`);
    assert.match(out(r), NO_BROWSER, args[0]);
  }
  fs.rmSync(dir, {recursive: true});
});

test('paginate and pageName split a set into numbered sheets', () => {
  const xs = [1, 2, 3, 4, 5];
  assert.deepEqual(paginate(xs), [xs]);
  assert.deepEqual(paginate(xs, {perPage: 2}), [[1, 2], [3, 4], [5]]);
  assert.deepEqual(paginate(xs, {pages: 2}), [[1, 2, 3], [4, 5]]);
  assert.deepEqual(paginate(xs, {pages: 4}), [[1, 2], [3], [4], [5]]); // exactly 4 sheets, not ceil(5/4)=2 per sheet -> 3
  assert.equal(paginate([1, 2, 3, 4, 5, 6, 7, 8, 9], {pages: 4}).length, 4);
  assert.deepEqual(paginate(xs, {pages: 9}), [[1], [2], [3], [4], [5]]);
  assert.deepEqual(paginate(xs, {perPage: 5}), [xs]);
  assert.equal(pageName('s.png', 0, 1), 's.png');
  assert.equal(pageName('d/s.png', 1, 3), 'd/s-2.png');
});

test('contact --per-page writes several sheets and lists them; default stays one file', { skip: !haveFont }, () => {
  const d = tmp();
  for (const n of ['a', 'b', 'c']) fs.writeFileSync(path.join(d, `${n}.svg`), figure(200, 100));
  const one = run(d, 'contact', 'a.svg', 'b.svg', 'c.svg', '--out', 's.png');
  assert.equal(one.status, 0, out(one));
  assert.ok(fs.existsSync(path.join(d, 's.png')));
  const r = run(d, 'contact', 'a.svg', 'b.svg', 'c.svg', '--out', 'p.png', '--per-page', '2');
  assert.equal(r.status, 0, out(r));
  assert.ok(fs.existsSync(path.join(d, 'p-1.png')) && fs.existsSync(path.join(d, 'p-2.png')));
  assert.ok(!fs.existsSync(path.join(d, 'p-3.png')));
  assert.match(r.stdout, /2 sheets: p-1\.png p-2\.png/);
  assert.notEqual(run(d, 'contact', 'a.svg', '--per-page', '2', '--pages', '2').status, 0);
});

test('preview without an output name writes a fresh temp file each time', { skip: !haveFont }, () => {
  const d = tmp();
  fs.writeFileSync(path.join(d, 'x.svg'), figure(100, 50));
  const paths = [1, 2].map(() => {
    const r = run(d, 'preview', 'x.svg');
    assert.equal(r.status, 0, out(r));
    const m = r.stdout.match(/wrote (\S+\.png)/);
    assert.ok(m, r.stdout);
    return m![1];
  });
  assert.notEqual(paths[0], paths[1]);
  for (const p of paths) { assert.ok(path.basename(p).startsWith('x-') && fs.existsSync(p)); fs.rmSync(p); }
});
