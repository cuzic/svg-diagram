// svg-diagram show: rasterize() and the CLI's non-terminal paths.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {image2sixel} from 'sixel';
import {rasterize, closeMeasurer} from '../lib/measure.ts';
import {xmlProblems} from '../lib/xml-check.ts';

test.after(() => closeMeasurer());

const svgOf = (w: number, h: number, body = '<rect width="100%" height="100%" fill="#1f5fa8"/>') => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${body}</svg>`;

test('rasterize: a tiny image still encodes to sixel (the pixel buffer must not be a view into a shared pool)', async () => {
  const r = await rasterize(svgOf(20, 20));
  assert.deepEqual([r.width, r.height, r.rgba.length], [20, 20, 20 * 20 * 4]);
  const seq = image2sixel(new Uint8ClampedArray(r.rgba), r.width, r.height, 256);
  assert.match(seq, /^\x1bP/);
});

test('rasterize: scale changes the size, and the page is white behind the picture', async () => {
  const r = await rasterize(svgOf(100, 50, ''), {scale: 0.5, png: true});
  assert.deepEqual([r.width, r.height], [50, 25]);
  assert.deepEqual([...r.rgba.subarray(0, 4)], [255, 255, 255, 255]);
  assert.equal(r.png!.subarray(1, 4).toString(), 'PNG');
});

test('rasterize: SVG that is not well-formed XML is an error (an <img> would not load it)', async () => {
  await assert.rejects(rasterize(svgOf(20, 20, '<g data-x></g>')), /could not load it as an <img>/);
});

test('xmlProblems: a control character in a label is reported', () => {
  assert.match(xmlProblems(svgOf(20, 20, '<text>a\x0Bb</text>'))[0], /control character U\+000B/);
});

test('the golden SVGs are all well-formed', () => {
  for (const f of fs.readdirSync('examples/out').filter(f => f.endsWith('.svg'))) assert.deepEqual(xmlProblems(fs.readFileSync(path.join('examples/out', f), 'utf8')), [], f);
});

const show = (...a: string[]) => spawnSync('node', ['show-diagram.ts', ...a], {encoding: 'utf8', input: ''});

test('show: not a terminal → no sixel, exit 1; --png wins over that; bad options exit 2', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'show-'));
  const svg = path.join(dir, 'a.svg');
  fs.writeFileSync(svg, svgOf(30, 20));
  const plain = show(svg);
  assert.equal(plain.status, 1);
  assert.match(plain.stderr, /not a terminal/);
  assert.equal(plain.stdout, '');
  const png = show(svg, '--png', path.join(dir, 'a.png'));
  assert.equal(png.status, 0, png.stderr);
  assert.ok(fs.existsSync(path.join(dir, 'a.png')));
  assert.equal(show(svg, '--colors', '4096').status, 2);
  assert.equal(show(svg, '--bogus').status, 2);
  assert.equal(show(svg, svg, '--png', path.join(dir, 'b.png')).status, 2);
  fs.rmSync(dir, {recursive: true});
});

test('show --force into a pipe writes sixel without asking any terminal, and --width is honoured (it only shrinks)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'show-'));
  const svg = path.join(dir, 'a.svg');
  fs.writeFileSync(svg, svgOf(400, 100));
  const out = show(svg, '--force', '--width', '200');
  assert.equal(out.status, 0, out.stderr);
  assert.match(out.stdout, /^\x1bP[0-9;]*q"1;1;200;50/);
  const wide = show(svg, '--force', '--width', '9000');
  assert.match(wide.stdout, /q"1;1;400;100/);
  fs.rmSync(dir, {recursive: true});
});

test('show: a .ts source that fails verification is still drawn, with the problem on stderr and exit 1', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'show-'));
  const src = path.join(dir, 'bad.ts');
  fs.writeFileSync(src, `import {diagram, row, box, connect} from '${path.resolve('lib/dsl.ts')}';\nexport default () => diagram({theme: 'blue'}).add(row([box({id: 'a', title: '左', body: '本文'}), box({id: 'b', title: '右', body: '本文'})], {gap: 24}), connect('a:right', 'b:left', {label: '長めのラベルです', chip: true, route: 'elbow'}));
`);
  const out = show(src, '--force');
  assert.equal(out.status, 1);
  assert.match(out.stderr, /overlaps its own end/);
  assert.match(out.stdout, /\x1bP/);
  fs.rmSync(dir, {recursive: true});
});
