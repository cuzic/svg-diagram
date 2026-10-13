// lib/raster.ts: drawing an SVG without a browser (resvg, with the layout's own font files), embedSvg, and how the engines are chosen.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {rasterize, svgSize, embedSvg, rasterizeWithResvg, prepareResvgFonts, resvgMarkers} from '../lib/raster.ts';
import {closeMeasurer} from '../lib/measure.ts';
import {resolveFontFile} from '../lib/font-metrics.ts';

test.after(() => closeMeasurer());

const ROOT = path.resolve(import.meta.dirname, '..');
const haveFont = resolveFontFile('sans') !== null;
// a font of its own for emoji (on a machine whose emoji stack falls through to the generic sans, the emoji font is the sans font)
const haveEmojiFont = (() => { const e = resolveFontFile('emoji'), s = resolveFontFile('sans'); return !!e && !!s && e.file !== s.file; })();
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
  const {chromiumUsesOurFont} = await import('./helpers/chromium-font.ts');
  if (!await chromiumUsesOurFont('sans', 400) || !await chromiumUsesOurFont('sans', 700)) return t.skip('Chromium draws the sans stack with another font than the layout measures');
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

// ---- a primary font that lacks the characters ----

const dejavu = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf';
const haveDejavu = fs.existsSync(dejavu);
const latinOnly = {sans: {regular: dejavu, bold: dejavu}, mono: {regular: dejavu, bold: dejavu}, emoji: {regular: dejavu, bold: dejavu}};

/** The options resvg would be given for this figure (the temporary fonts are removed again). */
const fontsFor = (svg: string, specs?: Parameters<typeof prepareResvgFonts>[1]) => { const p = prepareResvgFonts(svg, specs); p.cleanup(); return p.options; };

test('resvg is given fonts cut to the figure, and the family names to fall back to', {skip: haveFont ? false : 'no font file found'}, () => {
  const p = prepareResvgFonts(text('Hello'));
  try {
    assert.ok(p.options.fontFiles.length > 0 && p.options.fontFiles.every(f => fs.existsSync(f)));
    assert.ok(p.options.fontFiles.every(f => fs.statSync(f).size < 2_000_000), 'a cut font, not the 14 MB original');
    assert.ok(p.options.defaultFontFamily && p.options.sansSerifFamily === p.options.defaultFontFamily);
  } finally { p.cleanup(); }
});

test('the cut fonts are temporary files, gone after cleanup', {skip: haveFont ? false : 'no font file found'}, () => {
  const p = prepareResvgFonts(text('Hello'));
  const files = [...p.options.fontFiles];
  assert.ok(files.every(f => fs.existsSync(f)));
  p.cleanup();
  assert.ok(files.every(f => !fs.existsSync(f)));
  p.cleanup(); // twice is fine
  const dirs = fs.readdirSync(os.tmpdir()).filter(n => n.startsWith('svg-diagram-fonts-'));
  assert.ok(dirs.every(d => !files.some(f => f.includes(d))), 'no directory left behind by this call');
});

test('only the fonts the figure needs are loaded: bold only when something is bold, mono only for monospace text, emoji only for emoji', {skip: haveFont ? false : 'no font file found'}, () => {
  const n = (body: string) => fontsFor(svgOf(300, 100, body)).fontFiles.length;
  const plain = n('<text x="1" y="40" font-size="20">Hello</text>');
  const bold = n('<text x="1" y="40" font-size="20" font-weight="700">Hello</text>');
  const both = n('<text x="1" y="40" font-size="20">Hello <tspan font-weight="bold">there</tspan></text>');
  const mono = n('<text x="1" y="40" font-size="20" font-family="\'JetBrains Mono\',Consolas,monospace">x = 1</text>');
  const emoji = n('<text x="1" y="40" font-size="20">Hi 🙂</text>');
  const none = n('<rect width="10" height="10"/>');
  assert.equal(none, 0);
  assert.equal(plain, 1);
  assert.equal(bold, 1);
  assert.ok(both >= 2, 'regular and bold are two files (when they are not one family file)');
  assert.ok(mono >= 1);
  if (haveEmojiFont) assert.ok(emoji >= 2, 'the emoji font is added for an emoji');
});

test('the cut keeps what the figure draws: each example, byte for byte the same pixels as with the whole fonts', {skip: haveFont ? false : 'no font file found', timeout: 120_000}, async () => {
  const {Resvg} = await import('@resvg/resvg-js');
  const {fontFilesForTest} = await import('./helpers/whole-fonts.ts');
  for (const name of ['inventory-flow', 'column-grid']) {
    const svg = fs.readFileSync(path.join(ROOT, 'examples', 'out', `${name}.svg`), 'utf8');
    const cut = await rasterizeWithResvg(svg);
    const whole = fontFilesForTest();
    const p = prepareResvgFonts(svg), system = p.options.loadSystemFonts; p.cleanup(); // (the same decision about the system's fonts: this is about the cut, not about the fallback)
    const full = new Resvg(resvgMarkers(svg), {background: '#ffffff', font: {fontFiles: whole.files, loadSystemFonts: system, defaultFontFamily: whole.sans}}).render();
    assert.ok(Buffer.from(full.pixels).equals(cut.rgba), name);
  }
});

test('a cut figure draws in a fraction of the time the whole fonts take', {skip: haveFont ? false : 'no font file found', timeout: 120_000}, async () => {
  const svg = fs.readFileSync(path.join(ROOT, 'examples', 'out', 'inventory-flow.svg'), 'utf8');
  await rasterizeWithResvg(svg); // the first call also starts the subsetter
  const t0 = performance.now();
  await rasterizeWithResvg(svg);
  const cut = performance.now() - t0;
  assert.ok(cut < 1500, `${cut.toFixed(0)}ms`);
});

test('the system\'s fonts are read for a figure whose characters the layout\'s fonts cannot draw, and only then', {skip: haveDejavu ? false : 'needs DejaVu Sans'}, () => {
  assert.equal(fontsFor(text('Hello'), latinOnly).loadSystemFonts, false);
  assert.equal(fontsFor(text('在庫管理'), latinOnly).loadSystemFonts, true);
  assert.equal(fontsFor(svgOf(10, 10, '<rect width="5" height="5"/>'), latinOnly).loadSystemFonts, false, 'no text: nothing to draw, so no fonts at all');
  // what is in a <style> block, a <metadata> block or an attribute is not text that gets drawn
  assert.equal(fontsFor(svgOf(10, 10, '<metadata>在庫</metadata><style>/* 在庫 */</style><text x="1" y="9" data-x="在庫">ok</text>'), latinOnly).loadSystemFonts, false);
  assert.equal(fontsFor(text('Hello 在庫'), latinOnly).loadSystemFonts, true, 'one missing character is enough');
  assert.equal(fontsFor(text('a &amp; b'), latinOnly).loadSystemFonts, false, 'entities are decoded before looking');
});

test('with the layout\'s fonts able to draw it, Japanese needs no system fonts', {skip: haveFont ? false : 'no font file found'}, async () => {
  const {fontsCover} = await import('../lib/font-metrics.ts');
  assert.equal(fontsFor(text('在庫管理 Hello')).loadSystemFonts, !fontsCover('在庫管理 Hello'));
});

test('an emoji brings the emoji font in, and needs no system fonts', {skip: haveEmojiFont ? false : 'needs an emoji font of its own'}, () => {
  const sym = '\u{1F642}';
  const o = fontsFor(text(`a${sym}`));
  assert.ok(o.fontFiles.length >= 2);
  assert.equal(o.loadSystemFonts, false);
});

test('an emoji variation selector or joiner (no glyph of its own) does not make resvg scan the system fonts', {skip: haveEmojiFont ? false : 'needs an emoji font of its own'}, () => {
  const o = fontsFor(text('\u{2615}\u{FE0F} a\u{200D}b'));
  assert.equal(o.loadSystemFonts, false);
});

test('Japanese is drawn when the layout\'s fonts have none (a glyph from a system font, not just an empty box)', {skip: haveDejavu && haveFont ? false : 'needs DejaVu Sans and a Japanese font on the system'}, async () => {
  const withFallback = await rasterizeWithResvg(text('在庫管理'), {fonts: latinOnly});
  const own = await rasterizeWithResvg(text('在庫管理'));
  // the same characters in a Japanese font: the ink is of the same order (a row of empty boxes would be a different amount)
  const a = dark(withFallback), b = dark(own);
  assert.ok(Math.abs(a - b) / b < 0.35, `${a} vs ${b}`);
});

test('fontsCover: true when sans, mono and emoji fonts between them have every visible character', {skip: haveFont ? false : 'no font file found'}, async () => {
  const {fontsCover} = await import('../lib/font-metrics.ts');
  assert.equal(fontsCover('Hello 123'), true);
  assert.equal(fontsCover('  \n\t'), true);
  assert.equal(fontsCover(''), false, 'a private-use character no font has');
  if (haveDejavu) {
    assert.equal(fontsCover('Hello', latinOnly), true);
    assert.equal(fontsCover('在庫', latinOnly), false);
  }
});

test('a font HarfBuzz cannot cut is given to resvg whole, instead of failing the drawing', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'raster-junk-'));
  const junk = path.join(dir, 'junk.ttf');
  fs.writeFileSync(junk, 'this is not a font at all, just text padding '.repeat(20));
  const p = prepareResvgFonts(text('Hello'), {sans: {regular: junk, bold: junk}});
  try { assert.ok(p.options.fontFiles.includes(junk), p.options.fontFiles.join(', ')); } finally { p.cleanup(); fs.rmSync(dir, {recursive: true}); }
});

// ---- which characters the cut keeps ----

/** The code points of the fonts resvg is given for this figure. */
const keptBy = async (svg: string, specs?: Parameters<typeof prepareResvgFonts>[1]) => {
  const hb = await import('harfbuzzjs');
  const p = prepareResvgFonts(svg, specs);
  try {
    return new Set(p.options.fontFiles.flatMap(f => {
      const b = fs.readFileSync(f);
      return [...new hb.Face(new hb.Blob(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer), 0).collectUnicodes()];
    }));
  } finally { p.cleanup(); }
};

test('the cut keeps every character of the figure that the font has, spaces of every width included', {skip: haveFont ? false : 'no font file found'}, async () => {
  const {fontCoverage} = await import('../lib/font-metrics.ts');
  const has = fontCoverage('sans', 400)!;
  const kept = await keptBy(text('a b\u3000c\u00a0d在庫'));
  for (const ch of 'a b\u3000c\u00a0d在庫') { const cp = ch.codePointAt(0)!; assert.equal(kept.has(cp), has.has(cp), `U+${cp.toString(16)}`); }
  assert.ok(has.has(0x20) && kept.has(0x20), 'a plain space');
});

test('a newline in the source is drawn as a space, so the space is kept even if the text has none written', {skip: haveFont ? false : 'no font file found'}, async () => {
  assert.ok((await keptBy(text('line one\nline two'))).has(0x20));
  assert.ok((await keptBy(text('nospaces'))).has(0x20), 'and always');
});

test('characters in a <tspan> and in a text under a transformed group are kept', {skip: haveFont ? false : 'no font file found'}, async () => {
  const kept = await keptBy(svgOf(200, 100, '<g transform="translate(5 5)"><text x="1" y="40" font-size="20">a<tspan>b<tspan font-weight="700">c</tspan></tspan></text></g>'));
  for (const ch of 'abc') assert.ok(kept.has(ch.codePointAt(0)!), ch);
});

test('what is not drawn is not kept: titles, descriptions, style, metadata, attributes', {skip: haveFont ? false : 'no font file found'}, async () => {
  const kept = await keptBy(svgOf(200, 100, '<title>題名ZZ</title><desc>説明ZZ</desc><metadata>メタZZ</metadata><style>/* コメントZZ */</style><text x="1" y="40" font-size="20" data-x="属性ZZ">ok</text>'));
  assert.ok(kept.has('o'.codePointAt(0)!));
  for (const ch of '題名説明メタコメント属性Z') assert.ok(!kept.has(ch.codePointAt(0)!), ch);
});

test('a symbol that only the emoji font draws (and that is not an emoji by the layout\'s own test) brings the emoji font in', {skip: haveEmojiFont ? false : 'needs an emoji font of its own'}, async () => {
  const {fontCoverage} = await import('../lib/font-metrics.ts');
  const {EMOJI_RE} = await import('../lib/tokens.ts');
  const sansCov = fontCoverage('sans', 400)!, emojiCov = fontCoverage('emoji', 400)!;
  let sym: number | null = null;
  for (let cp = 0x2190; cp < 0x2c00 && sym === null; cp++) if (!sansCov.has(cp) && emojiCov.has(cp) && !EMOJI_RE.test(String.fromCodePoint(cp))) sym = cp;
  if (sym === null) return; // this machine's fonts have no such symbol: nothing to show
  const kept = await keptBy(text(`a${String.fromCodePoint(sym)}`));
  assert.ok(kept.has(sym), `U+${sym.toString(16)} is drawn by the emoji font, which must be loaded`);
});

test('resvg: an elbow ending downward gets a head pointing down, and marker-start a head pointing back (auto-start-reverse worked around)', async () => {
  const marker = '<defs><marker id="a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z"/></marker></defs>';
  const r = await rasterizeWithResvg(svgOf(200, 200, `${marker}<path d="M30,30 L30,100 L120,100 L120,150" fill="none" stroke="#000" stroke-width="2" marker-start="url(#a)" marker-end="url(#a)"/>`));
  // end (120,150): the head is 14 wide across the line and reaches only ~2px past the end; turned sideways it would reach 7px past
  assert.equal(dark(r, {x: 100, y: 156, w: 40, h: 30}), 0);
  assert.ok(dark(r, {x: 110, y: 135, w: 20, h: 15}) > 40, 'a head across the line just before the end');
  // start (30,30), the line leaves downward: the head points up, nothing more than ~2px above
  assert.equal(dark(r, {x: 10, y: 0, w: 40, h: 25}), 0);
  assert.ok(dark(r, {x: 20, y: 30, w: 20, h: 15}) > 40);
});
