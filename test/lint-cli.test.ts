// The lint command: its engines, its options, its exit codes and its report. The default engine (geometry) needs no browser; --engine
// browser is the same checks in Chromium. Every case runs without a browser except where it says otherwise.
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
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'lint-cli-'));
const STYLE = `<style>text { font-family: 'Hiragino Sans','Hiragino Kaku Gothic ProN','Yu Gothic','YuGothic',Meiryo,'Noto Sans JP',sans-serif; }</style>`;
const svg = (body: string, extra = '') => `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200" viewBox="0 0 400 200" ${extra}>${STYLE}<rect width="400" height="200" fill="#ffffff"/>${body}</svg>`;
const run = (cwd: string, args: string[], env: Record<string, string> = {}) => spawnSync(BIN, ['lint', ...args], {cwd, encoding: 'utf8', env: {...process.env, NODE_OPTIONS: `--import ${BLOCK}`, ...env}});
const out = (r: ReturnType<typeof run>) => `${r.stdout}\n${r.stderr}`;
const write = (dir: string, name: string, content: string) => { const f = path.join(dir, name); fs.writeFileSync(f, content); return f; };

const CLEAN = svg('<text x="20" y="40" font-size="16" fill="#22201b">ok</text>');

test('a clean file passes: exit 0, "0 error(s)", the number of files scanned', {skip}, () => {
  const dir = tmp();
  const r = run(dir, [write(dir, 'a.svg', CLEAN)]);
  assert.equal(r.status, 0, out(r));
  assert.match(r.stdout, /Scanned 1 file\(s\)/);
  assert.match(r.stdout, /✓ 0 error\(s\)/);
  fs.rmSync(dir, {recursive: true});
});

test('each check on the rendering has its own section in the report, and any of them fails the run', {skip}, () => {
  const dir = tmp();
  const cases: [string, string, RegExp][] = [
    ['contrast', svg('<text x="20" y="40" font-size="16" fill="#ffffff">faint</text>'), /Low-contrast text[\s\S]*?"faint" fg=rgb\(255, 255, 255\) bg=rgb\(255,255,255\) delta=0/],
    ['overflow', svg('<rect x="300" y="150" width="200" height="100" fill="#ccc"/>'), /Content overflowing declared canvas: 1 file[\s\S]*?dx=100 dy=50/],
    ['text overlap', svg('<text x="20" y="45" font-size="20">Overlapping</text><text x="24" y="50" font-size="20">Overlapping</text>'), /Text overlapping text[\s\S]*?"Overlapping" × "Overlapping" overlap=\d+%/],
  ];
  for (const [name, content, section] of cases) {
    const r = run(dir, [write(dir, `${name.replace(' ', '-')}.svg`, content)]);
    assert.equal(r.status, 1, `${name}: ${out(r)}`);
    assert.match(r.stdout, section, name);
    assert.match(r.stdout, /✗ [1-9]\d* error\(s\)/, name);
  }
  fs.rmSync(dir, {recursive: true});
});

test('the advisory checks are reported but only fail the run with --strict', {skip}, () => {
  const dir = tmp();
  const covered = write(dir, 'covered.svg', svg('<text x="100" y="60" font-size="20">covered text</text><rect x="110" y="40" width="40" height="30" fill="#f00"/>'));
  const loose = run(dir, [covered]);
  assert.equal(loose.status, 0, out(loose));
  assert.match(loose.stdout, /A shape painted over a text[\s\S]*?"covered text" is covered by a rect/);
  assert.match(loose.stdout, /✓ 0 error\(s\) \(1 advisory finding/);
  const strict = run(dir, ['--strict', covered]);
  assert.equal(strict.status, 1, out(strict));
  const boxed = write(dir, 'boxed.svg', svg('<rect x="20" y="20" width="200" height="100" fill="#fff" stroke="#000"/><text x="10" y="70" font-size="16">spills out</text>'));
  assert.match(run(dir, [boxed]).stdout, /Text spilling out of its enclosing box[\s\S]*?"spills out" overflows container by [\d.]+px/);
  fs.rmSync(dir, {recursive: true});
});

test('static checks and checks on the rendering are reported together for the same file', {skip}, () => {
  const dir = tmp();
  const r = run(dir, [write(dir, 'both.svg', svg('<text x="20" font-size="16" fill="#ffffff" writing-mode="tb">x</text>'))]);
  assert.equal(r.status, 1, out(r));
  assert.match(r.stdout, /\[text-missing-y\]/);
  assert.match(r.stdout, /\[writing-mode-tb\]/);
  assert.match(r.stdout, /Low-contrast text/);
  fs.rmSync(dir, {recursive: true});
});

test('a file that is not well-formed XML is reported as an error, not skipped and not a crash', {skip}, () => {
  const dir = tmp();
  const r = run(dir, [write(dir, 'broken.svg', svg('<g data-badge></g>')), write(dir, 'fine.svg', CLEAN)]);
  assert.equal(r.status, 1, out(r));
  assert.match(r.stdout, /\[not-well-formed-xml\]/);
  assert.match(r.stdout, /broken\.svg — not well-formed XML/);
  assert.match(r.stdout, /Scanned 2 file/);
  fs.rmSync(dir, {recursive: true});
});

test('a file with no <svg> in it is skipped by the checks on the rendering', {skip}, () => {
  const dir = tmp();
  const r = run(dir, [write(dir, 'empty.svg', '<html/>')]);
  assert.equal(r.status, 0, out(r));
  fs.rmSync(dir, {recursive: true});
});

test('with no file named it lints svg/*.svg of the project; with none there, exit 2', {skip}, () => {
  const dir = tmp();
  assert.equal(run(dir, []).status, 2);
  fs.mkdirSync(path.join(dir, 'svg'));
  write(path.join(dir, 'svg'), 'a.svg', CLEAN);
  write(path.join(dir, 'svg'), 'b.svg', CLEAN);
  const r = run(dir, []);
  assert.equal(r.status, 0, out(r));
  assert.match(r.stdout, /Scanned 2 file/);
  fs.rmSync(dir, {recursive: true});
});

test('--engine: geometry (the default) and browser are the only values; a missing or unknown one is a usage error', {skip}, () => {
  const dir = tmp();
  const f = write(dir, 'a.svg', CLEAN);
  for (const args of [['--engine', 'netscape', f], [f, '--engine']]) {
    const r = run(dir, args);
    assert.equal(r.status, 2, out(r));
    assert.match(out(r), /--engine is geometry or browser/);
  }
  assert.equal(run(dir, ['--engine', 'geometry', f]).status, 0);
  assert.equal(run(dir, [f]).stdout, run(dir, ['--engine', 'geometry', f]).stdout);
  fs.rmSync(dir, {recursive: true});
});

test('--engine geometry with a font setting that cannot work stops with exit 2 and points to the other engine; no browser is involved', {skip}, () => {
  const dir = tmp();
  write(dir, '.svg-diagram.json', JSON.stringify({fonts: {sans: {regular: '/no/such/font.ttf', bold: '/no/such/font.ttf'}}}));
  const f = write(dir, 'a.svg', CLEAN);
  const r = run(dir, [f]);
  assert.equal(r.status, 2, out(r));
  assert.match(out(r), /the checks on the rendering could not run/);
  assert.match(out(r), /font\.ttf/);
  assert.match(out(r), /--engine browser/);
  fs.rmSync(dir, {recursive: true});
});

test('--fix raises a font size below the floor, then lints again', {skip}, () => {
  const dir = tmp();
  const f = write(dir, 'small.svg', svg('<text x="20" y="40" font-size="10" fill="#22201b">small</text>'));
  const r = run(dir, ['--fix', f]);
  assert.match(r.stdout, /Fixed \(--fix\): 1/);
  assert.match(fs.readFileSync(f, 'utf8'), /font-size="14"/);
  fs.rmSync(dir, {recursive: true});
});

test('the browser engine reports the same sections for the same files (browser needed)', {skip, timeout: 120_000}, (t) => {
  const dir = tmp();
  const f = write(dir, 'defects.svg', svg('<text x="20" y="40" font-size="16" fill="#ffffff">faint</text><rect x="300" y="150" width="200" height="100" fill="#ccc"/>'));
  const browser = spawnSync(BIN, ['lint', '--engine', 'browser', f], {cwd: dir, encoding: 'utf8'});
  if (browser.status === 2) return t.skip(`no browser: ${out(browser).split('\n')[0]}`);
  const geometry = spawnSync(BIN, ['lint', f], {cwd: dir, encoding: 'utf8'});
  assert.equal(browser.status, geometry.status);
  assert.equal(browser.stdout, geometry.stdout);
  fs.rmSync(dir, {recursive: true});
});

test('the examples pass with --strict, as CI runs them', {skip}, () => {
  const dir = tmp();
  const r = run(ROOT, ['--strict', ...fs.readdirSync(path.join(ROOT, 'examples', 'out')).filter(f => f.endsWith('.svg')).map(f => path.join(ROOT, 'examples', 'out', f))]);
  assert.equal(r.status, 0, out(r));
  fs.rmSync(dir, {recursive: true});
});
