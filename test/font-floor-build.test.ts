// ADR 0017 U3b: build says so itself when a canvas figure lowers the text floor, and hands its own config to lint-svg.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const ROOT = path.resolve(import.meta.dirname, '..');
const BUILD = path.join(ROOT, 'build-diagram.ts');
const node = (cwd: string, ...args: string[]) => spawnSync(process.execPath, [BUILD, ...args], {cwd, encoding: 'utf8'});
const out = (r: ReturnType<typeof node>) => `${r.stdout}\n${r.stderr}`;
const src = (canvas: string) => `import {diagram, box, row, connect} from 'svg-diagram';
export default () => {
  const d = diagram({theme: 'blue', title: '試験図', canvas: ${canvas}});
  d.add(row([box({id: 'a', title: '入口'}), box({id: 'b', title: '出口'})]), connect('a:right', 'b:left'));
  return d;
};
`;
const project = (config: object | null) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'floor-build-'));
  fs.mkdirSync(path.join(dir, 'src'));
  fs.writeFileSync(path.join(dir, 'src', 'dense.ts'), src('{minText: 10}'));
  fs.writeFileSync(path.join(dir, 'src', 'plain.ts'), src("'slide'"));
  if (config) fs.writeFileSync(path.join(dir, '.svg-diagram.json'), JSON.stringify(config));
  return dir;
};

test('build: a figure with minText below 14 prints the one-line notice on stderr, and the build passes (exit 0)', () => {
  const dir = project({fontFloor: 10});
  const r = node(dir, 'src/dense.ts');
  assert.equal(r.status, 0, out(r));
  assert.match(r.stderr, /⚠ svg\/dense\.svg: 文字の下限を 10px に下げている\(fontFloor 10。投影には向かない\)/);
  assert.match(fs.readFileSync(path.join(dir, 'svg', 'dense.svg'), 'utf8'), /^<svg [^>]*data-min-text="10"/);
});

test('build: no notice for a canvas at 14 or more', () => {
  const dir = project({fontFloor: 10});
  const r = node(dir, 'src/plain.ts');
  assert.equal(r.status, 0, out(r));
  assert.doesNotMatch(out(r), /文字の下限/);
});

test('build: without a fontFloor the figure is refused (applyConfig throws), and nothing is written', () => {
  const dir = project(null);
  const r = node(dir, 'src/dense.ts');
  assert.equal(r.status, 1, out(r));
  assert.match(out(r), /fontFloor/);
  assert.equal(fs.existsSync(path.join(dir, 'svg', 'dense.svg')), false);
});

test('build: lint-svg gets the build\'s own config (--config), so an output dir with a config of its own cannot disagree', () => {
  const dir = project({fontFloor: 10});
  fs.mkdirSync(path.join(dir, 'out'));
  fs.writeFileSync(path.join(dir, 'out', '.svg-diagram.json'), '{}'); // a nearer config without fontFloor
  const r = node(dir, 'src/dense.ts', '--out', 'out/dense.svg');
  assert.equal(r.status, 0, out(r));
});
