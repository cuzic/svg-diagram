// ADR 0017 U3: lint-svg's text floor is the figure's own data-min-text (when the project's fontFloor allows it), else 14. Hand-written SVGs only.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {resolveFontFile} from '../lib/font-metrics.ts';

const ROOT = path.resolve(import.meta.dirname, '..');
const BIN = path.join(ROOT, 'bin', 'svg-diagram');
const BLOCK = pathToFileURL(path.join(import.meta.dirname, 'helpers', 'block-playwright-register.ts')).href;
const skip = resolveFontFile('sans') ? false : 'no font file found';
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'lint-floor-'));
const STYLE = `<style>text { font-family: 'Hiragino Sans','Hiragino Kaku Gothic ProN','Yu Gothic','YuGothic',Meiryo,'Noto Sans JP',sans-serif; }</style>`;
const svg = (size: number, attrs = '') => `<svg xmlns="http://www.w3.org/2000/svg"${attrs} width="400" height="200" viewBox="0 0 400 200">${STYLE}<rect width="400" height="200" fill="#ffffff"/><text x="20" y="40" font-size="${size}" fill="#22201b">ok</text></svg>`;
const run = (cwd: string, args: string[]) => spawnSync(BIN, ['lint', ...args], {cwd, encoding: 'utf8', env: {...process.env, NODE_OPTIONS: `--import ${BLOCK}`}});
const out = (r: ReturnType<typeof run>) => `${r.stdout}\n${r.stderr}`;
const write = (dir: string, name: string, content: string) => { const f = path.join(dir, name); fs.mkdirSync(path.dirname(f), {recursive: true}); fs.writeFileSync(f, content); return f; };
const floorConfig = (dir: string, fontFloor: number) => write(dir, '.svg-diagram.json', JSON.stringify({fontFloor}));

test('no data-min-text: a 10px text is font-size-too-small against the 14px floor', {skip}, () => {
  const dir = tmp();
  const r = run(dir, [write(dir, 'a.svg', svg(10))]);
  assert.equal(r.status, 1, out(r));
  assert.match(r.stdout, /\[font-size-too-small\][\s\S]*below the 14px floor: 10px/);
  assert.doesNotMatch(r.stdout, /font-floor-not-permitted/);
});

test('data-min-text="10" without a fontFloor in the project: font-floor-not-permitted (an error)', {skip}, () => {
  const dir = tmp();
  const r = run(dir, [write(dir, 'a.svg', svg(10, ' data-min-text="10"'))]);
  assert.equal(r.status, 1, out(r));
  assert.match(r.stdout, /\[font-floor-not-permitted\]/);
});

test('data-min-text="10" with fontFloor 10: passes, with a notice that does not count as a failure (also under --strict)', {skip}, () => {
  const dir = tmp();
  floorConfig(dir, 10);
  const f = write(dir, 'a.svg', svg(10, ' data-min-text="10"'));
  for (const args of [[f], ['--strict', f]]) {
    const r = run(dir, args);
    assert.equal(r.status, 0, out(r));
    assert.match(r.stdout, /お知らせ/);
    assert.match(r.stdout, /\[font-floor-lowered\].*minText 10px/);
    assert.match(r.stdout, /✓ 0 error\(s\)/);
  }
});

test('data-min-text="10" with 9px text: still font-size-too-small, against the declared floor', {skip}, () => {
  const dir = tmp();
  floorConfig(dir, 10);
  const r = run(dir, [write(dir, 'a.svg', svg(9, ' data-min-text="10"'))]);
  assert.equal(r.status, 1, out(r));
  assert.match(r.stdout, /below the 10px floor: 9px/);
});

test('--fix raises to the declared floor (10), or to 14 without one', {skip}, () => {
  const dir = tmp();
  floorConfig(dir, 10);
  const a = write(dir, 'a.svg', svg(9, ' data-min-text="10"'));
  const c = write(tmp(), 'c.svg', svg(9));
  run(dir, ['--fix', a]);
  assert.match(fs.readFileSync(a, 'utf8'), /font-size="10"/);
  run(dir, ['--fix', c]);
  assert.match(fs.readFileSync(c, 'utf8'), /font-size="14"/);
});

test('the config is found from the SVG\'s directory, not the cwd; --config names one explicitly', {skip}, () => {
  const proj = tmp(), elsewhere = tmp();
  floorConfig(proj, 10);
  const f = write(proj, 'out/a.svg', svg(10, ' data-min-text="10"'));
  const r = run(elsewhere, [f]);
  assert.equal(r.status, 0, out(r));
  const lone = write(tmp(), 'b.svg', svg(10, ' data-min-text="10"'));
  assert.equal(run(elsewhere, [lone]).status, 1);
  const r2 = run(elsewhere, ['--config', path.join(proj, '.svg-diagram.json'), lone]);
  assert.equal(r2.status, 0, out(r2));
});

test('a data-min-text that is not a number of 10 or more is font-floor-not-permitted', {skip}, () => {
  const dir = tmp();
  floorConfig(dir, 10);
  for (const v of ['9', 'abc', '']) {
    const r = run(dir, [write(dir, 'a.svg', svg(12, ` data-min-text="${v}"`))]);
    assert.equal(r.status, 1, `${v}: ${out(r)}`);
    assert.match(r.stdout, /font-floor-not-permitted/, v);
  }
});
