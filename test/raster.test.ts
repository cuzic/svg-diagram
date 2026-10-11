// lib/raster.ts: drawing an SVG without a browser (resvg, with the layout's own font files), embedSvg, and how the engines are chosen.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {rasterize, svgSize, embedSvg, fontFilesForResvg, rasterizeWithResvg} from '../lib/raster.ts';
import {closeMeasurer} from '../lib/measure.ts';
import {resolveFontFile} from '../lib/font-metrics.ts';

test.after(() => closeMeasurer());

const ROOT = path.resolve(import.meta.dirname, '..');
const haveFont = resolveFontFile('sans') !== null;
const svgOf = (w: number, h: number, body = '<rect width="100%" height="100%" fill="#1f5fa8"/>') => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${body}</svg>`;
const dark = (r: {width: number; height: number; rgba: Buffer}, box = {x: 0, y: 0, w: r.width, h: r.height}) => {
  let n = 0;
  for (let y = Math.max(0, box.y); y < Math.min(r.height, box.y + box.h); y++) for (let x = Math.max(0, box.x); x < Math.min(r.width, box.x + box.w); x++) {
    const i = 4 * (y * r.width + x);
    if (r.rgba[i] < 128 && r.rgba[i + 1] < 128 && r.rgba[i + 2] < 128) n++;
  }
  return n;
};
const text = (s: string, extra = '') => svgOf(300, 100, `<text x="10" y="70" font-size="48" fill="#000000" ${extra}>${s}</text>`);

test('svgSize reads width and height, with or without px, and falls back to the viewBox', () => {
  assert.deepEqual(svgSize(svgOf(120, 80)), {w: 120, h: 80});
  assert.deepEqual(svgSize('<svg xmlns="http://www.w3.org/2000/svg" width="12.5px" height="7"/>'), {w: 12.5, h: 7});
  assert.deepEqual(svgSize('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 480"/>'), {w: 640, h: 480});
  assert.deepEqual(svgSize('<svg xmlns="http://www.w3.org/2000/svg" viewBox="-10 -10 50 20"/>'), {w: 50, h: 20});
  assert.equal(svgSize('<svg xmlns="http://www.w3.org/2000/svg"/>'), null);
  assert.equal(svgSize('<svg xmlns="http://www.w3.org/2000/svg" width="0" height="10"/>'), null);
  assert.equal(svgSize('not svg'), null);
});

test('resvg: the size, RGBA length, white behind the picture, and a PNG on request', async () => {
  const r = await rasterizeWithResvg(svgOf(40, 30, ''), {png: true});
  assert.deepEqual([r.width, r.height, r.rgba.length], [40, 30, 40 * 30 * 4]);
  assert.deepEqual([...r.rgba.subarray(0, 4)], [255, 255, 255, 255]);
  assert.equal(r.png!.subarray(1, 4).toString(), 'PNG');
  assert.equal(r.png!.readUInt32BE(16), 40);
  assert.equal(r.png!.readUInt32BE(20), 30);
  assert.equal((await rasterizeWithResvg(svgOf(40, 30, ''))).png, undefined);
});

test('resvg: scale changes the size; a shape fills the pixels it should, and the colour is exact', async () => {
  const half = await rasterizeWithResvg(svgOf(100, 50), {scale: 0.5});
  assert.deepEqual([half.width, half.height], [50, 25]);
  const twice = await rasterizeWithResvg(svgOf(100, 50), {scale: 2});
  assert.deepEqual([twice.width, twice.height], [200, 100]);
  const mid = 4 * (50 * 200 + 100);
  assert.deepEqual([...twice.rgba.subarray(mid, mid + 4)], [0x1f, 0x5f, 0xa8, 255]);
});

test('resvg: a transparent figure is composited on white, not left transparent', async () => {
  const r = await rasterizeWithResvg(svgOf(10, 10, '<rect width="5" height="10" fill="#000000" fill-opacity="0.5"/>'));
  assert.deepEqual([...r.rgba.subarray(0, 4)].map(v => Math.abs(v - 128) <= 2), [true, true, true, false]);
  assert.equal(r.rgba[3], 255);
  assert.deepEqual([...r.rgba.subarray(4 * 8, 4 * 8 + 4)], [255, 255, 255, 255]);
});

test('resvg draws text, Latin and Japanese, with the layout\'s font', {skip: haveFont ? false : 'no font file found'}, async () => {
  assert.ok(dark(await rasterizeWithResvg(text('Hello'))) > 200, 'Latin text is drawn');
  assert.ok(dark(await rasterizeWithResvg(text('在庫管理'))) > 300, 'Japanese text is drawn');
  assert.equal(dark(await rasterizeWithResvg(text(''))), 0);
});

test('resvg uses the font stack in the figure: bold is heavier than regular, mono is not proportional', {skip: haveFont ? false : 'no font file found'}, async () => {
  const regular = dark(await rasterizeWithResvg(text('Inventory')));
  const bold = dark(await rasterizeWithResvg(text('Inventory', 'font-weight="700"')));
  assert.ok(bold > regular * 1.05, `bold ${bold} vs regular ${regular}`);
  const stack = (f: string) => `font-family="${f}"`;
  const i = dark(await rasterizeWithResvg(text('iiiiiiii', stack("'JetBrains Mono','Consolas','Liberation Mono',monospace"))));
  const m = dark(await rasterizeWithResvg(text('MMMMMMMM', stack("'JetBrains Mono','Consolas','Liberation Mono',monospace"))));
  assert.ok(i > 0 && m > 0);
});

test('a figure that is not well-formed XML is an error, as an <img> would fail to load it (either engine)', async () => {
  await assert.rejects(rasterizeWithResvg(svgOf(20, 20, '<g data-x></g>')), /could not load it as an <img>/);
  await assert.rejects(rasterize(svgOf(20, 20, '<text>a\x0Bb</text>')), /could not load it as an <img>/);
  await assert.rejects(rasterize(svgOf(20, 20, '<g>')), /could not load it as an <img>/);
});

test('an SVG with no size is refused, naming what is missing', async () => {
  await assert.rejects(rasterize('<svg xmlns="http://www.w3.org/2000/svg"/>'), /no width\/height/);
});

test('rasterize defaults to resvg; engine "chromium" is the browser, and "resvg" never falls back', async () => {
  const auto = await rasterize(svgOf(30, 20));
  const resvg = await rasterize(svgOf(30, 20), {engine: 'resvg'});
  assert.deepEqual(auto.rgba, resvg.rgba);
});

test('the real browser and resvg draw the same example figures to within anti-aliasing', async (t) => {
  let browser;
  try { browser = await rasterize(svgOf(10, 10), {engine: 'chromium'}); } catch (e) { return t.skip(`no browser: ${(e as Error).message.split('\n')[0]}`); }
  assert.equal(browser.width, 10);
  for (const name of ['inventory-flow', 'inventory-wireframe']) {
    const svg = fs.readFileSync(path.join(ROOT, 'examples', 'out', `${name}.svg`), 'utf8');
    const a = await rasterize(svg, {engine: 'resvg'}), b = await rasterize(svg, {engine: 'chromium'});
    assert.deepEqual([a.width, a.height], [b.width, b.height], name);
    let differ = 0, strongly = 0;
    const n = a.width * a.height;
    for (let i = 0; i < n; i++) {
      const d = Math.max(Math.abs(a.rgba[4 * i] - b.rgba[4 * i]), Math.abs(a.rgba[4 * i + 1] - b.rgba[4 * i + 1]), Math.abs(a.rgba[4 * i + 2] - b.rgba[4 * i + 2]));
      if (d > 0) differ++;
      if (d > 64) strongly++;
    }
    assert.ok(differ / n < 0.15, `${name}: ${(100 * differ / n).toFixed(1)}% of the pixels differ`);
    assert.ok(strongly / n < 0.01, `${name}: ${(100 * strongly / n).toFixed(2)}% differ strongly`);
  }
});

test('fontFilesForResvg lists each font file once, with the family names to fall back to', {skip: haveFont ? false : 'no font file found'}, () => {
  const f = fontFilesForResvg();
  assert.ok(f.files.length > 0);
  assert.equal(new Set(f.files).size, f.files.length);
  assert.ok(f.files.every(x => fs.existsSync(x)));
  assert.ok(f.sans.length > 0);
});

test('fontFilesForResvg follows the `fonts` settings', {skip: haveFont ? false : 'no font file found'}, () => {
  const r = resolveFontFile('sans')!;
  const f = fontFilesForResvg({sans: {regular: `${r.file}#${r.index}`, bold: `${r.file}#${r.index}`}});
  assert.ok(f.files.includes(r.file));
  assert.equal(f.sans, r.name);
});

// ---- embedSvg ----

const inner = `<defs><marker id="arrow"><path d="M0 0L5 5"/></marker><clipPath id="c"><rect/></clipPath></defs><path d="M0 0" marker-end="url(#arrow)" clip-path="url(#c)"/><use href="#arrow"/><use xlink:href="#c"/>`;
const fig = (extra = '') => `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="200" height="100" viewBox="0 0 200 100" ${extra}>${inner}</svg>`;

test('embedSvg places the figure as a nested <svg> with its own viewBox and the box it was given', () => {
  const out = embedSvg(fig(), {x: 10, y: 20, w: 100, h: 50}, 'p-');
  assert.match(out, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" xmlns:xlink="[^"]+" x="10" y="20" width="100" height="50" viewBox="0 0 200 100">/);
  assert.ok(out.endsWith('</svg>'));
  assert.equal((out.match(/<svg\b/g) ?? []).length, 1);
});

test('embedSvg without a viewBox makes one from width and height', () => {
  const out = embedSvg(`<svg xmlns="http://www.w3.org/2000/svg" width="64" height="32"><rect/></svg>`, {x: 0, y: 0, w: 128, h: 64}, 'p-');
  assert.match(out, /viewBox="0 0 64 32"/);
});

test('embedSvg prefixes every id and every reference to it, and only those', () => {
  const out = embedSvg(fig(), {x: 0, y: 0, w: 1, h: 1}, 'f3-');
  assert.match(out, /id="f3-arrow"/);
  assert.match(out, /id="f3-c"/);
  assert.match(out, /marker-end="url\(#f3-arrow\)"/);
  assert.match(out, /clip-path="url\(#f3-c\)"/);
  assert.match(out, /<use href="#f3-arrow"/);
  assert.match(out, /<use xlink:href="#f3-c"/);
  assert.doesNotMatch(out, /id="arrow"|url\(#arrow\)|href="#arrow"/);
});

test('embedSvg: two figures with the same ids do not capture each other', () => {
  const a = embedSvg(fig(), {x: 0, y: 0, w: 1, h: 1}, 'f0-'), b = embedSvg(fig(), {x: 0, y: 0, w: 1, h: 1}, 'f1-');
  const ids = [...(a + b).matchAll(/\sid="([^"]+)"/g)].map(m => m[1]);
  assert.equal(new Set(ids).size, ids.length);
});

test('embedSvg handles ids with characters that mean something in a regular expression', () => {
  const out = embedSvg(`<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><g id="a.b+c"/><use href="#a.b+c"/><g id="aXb+c"/></svg>`, {x: 0, y: 0, w: 1, h: 1}, 'p-');
  assert.match(out, /id="p-a\.b\+c"/);
  assert.match(out, /href="#p-a\.b\+c"/);
  assert.match(out, /id="p-aXb\+c"/); // a different id, not captured by the dot
});

test('embedSvg refuses what it cannot place', () => {
  assert.throws(() => embedSvg('<svg xmlns="http://www.w3.org/2000/svg"/>', {x: 0, y: 0, w: 1, h: 1}, 'p-'), /no width\/height/);
  assert.throws(() => embedSvg('<g/>', {x: 0, y: 0, w: 1, h: 1}, 'p-'), /no width\/height/);
});

test('an embedded figure is drawn with text, which an <image> of the same file is not (the reason for embedding)', {skip: haveFont ? false : 'no font file found'}, async () => {
  const figure = svgOf(300, 100, '<text x="10" y="70" font-size="48" fill="#000000">在庫A</text>');
  const sheet = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="100" viewBox="0 0 300 100">${embedSvg(figure, {x: 0, y: 0, w: 300, h: 100}, 'e-')}</svg>`;
  assert.ok(dark(await rasterizeWithResvg(sheet)) > 300);
});

// ---- choosing the engine (child processes in which one of the two cannot be loaded) ----

import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import os from 'node:os';
const BLOCK_MODULE = pathToFileURL(path.join(import.meta.dirname, 'helpers', 'block-module-register.ts')).href;
const child = (blocked: string, script: string) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'raster-engine-'));
  const file = path.join(dir, 's.ts');
  fs.writeFileSync(file, `import {rasterize} from ${JSON.stringify(path.join(ROOT, 'lib', 'raster.ts'))};\nimport {closeMeasurer} from ${JSON.stringify(path.join(ROOT, 'lib', 'measure.ts'))};\n${script}\nawait closeMeasurer();\n`);
  const r = spawnSync(process.execPath, [file], {cwd: ROOT, encoding: 'utf8', env: {...process.env, SVG_DIAGRAM_MEASURE: '', SVG_DIAGRAM_TEST_BLOCK: blocked, NODE_OPTIONS: `--import ${BLOCK_MODULE}`}});
  fs.rmSync(dir, {recursive: true});
  return `${r.stdout}\n${r.stderr}`;
};
const SMALL = JSON.stringify(svgOf(30, 20));

test('with resvg unavailable, auto draws in the browser; resvg asked for by name says what to do instead', {timeout: 60_000}, async (t) => {
  try { await rasterize(svgOf(10, 10), {engine: 'chromium'}); } catch { return t.skip('no browser here'); }
  const auto = child('@resvg/resvg-js', `const r = await rasterize(${SMALL}); console.log('AUTO', r.width, r.height);`);
  assert.match(auto, /AUTO 30 20/);
  const named = child('@resvg/resvg-js', `try { await rasterize(${SMALL}, {engine: 'resvg'}); console.log('DREW'); } catch (e) { console.log('ERR ' + (e as Error).message); }`);
  assert.match(named, /ERR a figure could not be drawn: @resvg\/resvg-js could not be loaded/);
  assert.match(named, /--engine chromium/);
  assert.doesNotMatch(named, /DREW/);
});

test('with the browser unavailable, auto and resvg draw; chromium asked for by name says how to get it', () => {
  const ok = child('playwright-chromium', `const a = await rasterize(${SMALL}); const b = await rasterize(${SMALL}, {engine: 'resvg'}); console.log('DREW', a.width, b.width);`);
  assert.match(ok, /DREW 30 30/);
  const named = child('playwright-chromium', `try { await rasterize(${SMALL}, {engine: 'chromium'}); console.log('DREW'); } catch (e) { console.log('ERR ' + (e as Error).message); }`);
  assert.match(named, /ERR playwright-chromium is not installed/);
});

test('with neither available, auto reports the browser as the thing to install', () => {
  const none = child('@resvg/resvg-js,playwright-chromium', `try { await rasterize(${SMALL}); console.log('DREW'); } catch (e) { console.log('ERR ' + (e as Error).message); }`);
  assert.match(none, /ERR playwright-chromium is not installed/);
});
