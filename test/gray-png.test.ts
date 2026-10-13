// node --test test/   — build --png, preview --gray and the gray-tone-collision rule (issue #79).
import test from 'node:test';
import './helpers/strict-width.ts';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {box, checkDiagram, closeMeasurer, diagram} from '../lib/dsl.ts';
import {grayscaleSvg, rasterize} from '../lib/raster.ts';

test.after(() => closeMeasurer());
const ROOT = path.resolve(import.meta.dirname, '..');
const gray = async (...tones: (string | undefined)[]) => {
  const d = diagram({theme: 'blue'});
  d.add(...tones.map((tone, i) => box({id: `b${i}`, title: `b${i}`, ...(tone ? {tone: tone as 'accent'} : {})})));
  return (await checkDiagram(d)).verdict.findings.filter(f => f.rule === 'gray-tone-collision');
};

test('gray-tone-collision: plain next to accent (soft fill) warns; solid next to plain does not', async () => {
  const hit = await gray(undefined, 'accent');
  assert.equal(hit.length, 1);
  assert.equal(hit[0].severity, 'warn');
  assert.match(hit[0].message, /plain・accent/);
  assert.deepEqual(await gray(undefined, 'solid'), []);
});

test('gray-tone-collision: one tone, same-fill tones (new / accent) and dashed-vs-solid outlines are not collisions', async () => {
  assert.deepEqual(await gray('accent', 'accent'), []);
  assert.deepEqual(await gray('accent', 'new'), []);
  assert.deepEqual(await gray(undefined, 'changed'), []); // both white: the outline is the cue, in colour too
  assert.deepEqual(await gray(undefined, 'danger'), []); // white fill, but a dashed outline
});

test('gray-tone-collision: accept turns it into info', async () => {
  const d = diagram({theme: 'blue', accept: {'gray-tone-collision': 'colour print only'}});
  d.add(box({id: 'a', title: 'a'}), box({id: 'b', title: 'b', tone: 'accent'}));
  const f = (await checkDiagram(d)).verdict.findings.find(x => x.rule === 'gray-tone-collision');
  assert.equal(f?.severity, 'info');
});

test('grayscaleSvg: a coloured rect is drawn grey', async () => {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4"><rect width="4" height="4" fill="#ff0000"/></svg>';
  const px = (await rasterize(grayscaleSvg(svg), {})).rgba;
  assert.ok(px[0] === px[1] && px[1] === px[2] && px[0] > 0 && px[0] < 255, `${px[0]},${px[1]},${px[2]}`);
  assert.equal((await rasterize(svg, {})).rgba[0], 255);
  // content with no height (a lone line) is still drawn: the filter region is not the group's bounding box
  const line = '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><line x1="0" y1="5" x2="10" y2="5" stroke="#ff0000" stroke-width="4"/></svg>';
  assert.ok((await rasterize(grayscaleSvg(line), {})).rgba[(5 * 10 + 5) * 4] < 200);
  // a viewBox that does not start at 0 0 (resvg used to panic on a percent region there)
  const off = '<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4" viewBox="-100 -100 4 4"><rect x="-100" y="-100" width="4" height="4" fill="#0000ff"/></svg>';
  const o = (await rasterize(grayscaleSvg(off), {})).rgba;
  assert.ok(o[0] === o[2] && o[0] < 100, `${o[0]},${o[1]},${o[2]}`);
});

test('CLI: build --png writes the SVG and the PNG; preview --gray writes a PNG', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gray-png-'));
  fs.writeFileSync(path.join(dir, 'a.ts'), `import {diagram, box} from ${JSON.stringify(path.join(ROOT, 'lib/dsl.ts'))};\nexport default () => diagram({theme: 'blue'}).add(box({title: 'x', tone: 'accent'}));\n`);
  const run = (script: string, ...a: string[]) => spawnSync(process.execPath, [path.join(ROOT, script), ...a], {cwd: dir, encoding: 'utf8'});
  const b = run('build-diagram.ts', 'a.ts', '--out-dir', 'svg', '--png', 'png', '--scale', '1', '--no-lint');
  assert.equal(b.status, 0, b.stdout + b.stderr);
  assert.ok(fs.existsSync(path.join(dir, 'svg/a.svg')));
  const png = fs.readFileSync(path.join(dir, 'png/a.png'));
  assert.equal(png.subarray(1, 4).toString(), 'PNG');
  const p = run('preview-svg.ts', 'svg/a.svg', 'g.png', '--gray');
  assert.equal(p.status, 0, p.stdout + p.stderr);
  assert.ok(fs.statSync(path.join(dir, 'g.png')).size > 0);
  assert.notEqual(run('build-diagram.ts', 'a.ts', '--png').status, 0);
  assert.notEqual(run('build-diagram.ts', 'a.ts', '--scale', '2').status, 0); // --scale without --png
  // --stale: an up-to-date SVG whose PNG is missing is built again, so the PNG appears
  fs.rmSync(path.join(dir, 'png'), {recursive: true});
  const s = run('build-diagram.ts', 'a.ts', '--out-dir', 'svg', '--png', 'png', '--stale', '--no-lint');
  assert.equal(s.status, 0, s.stdout + s.stderr);
  assert.ok(fs.existsSync(path.join(dir, 'png/a.png')));
  assert.match(run('build-diagram.ts', 'a.ts', '--out-dir', 'svg', '--png', 'png', '--stale', '--no-lint').stdout, /スキップ/);
  fs.rmSync(dir, {recursive: true, force: true});
});
