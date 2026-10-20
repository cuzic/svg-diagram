// ADR 0023 U5: `--no-source-line` draws without diagram({sourceLine}); the metadata remembers it so --stale and --drift --rebuild agree.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {renderSource, close} from '../lib/render-source.ts';

test.after(() => close());

const ROOT = path.resolve(import.meta.dirname, '..');
const run = (script: string, cwd: string, ...args: string[]) => spawnSync(process.execPath, [path.join(ROOT, script), ...args], {cwd, encoding: 'utf8'});
const text = (r: ReturnType<typeof run>) => `${r.stdout}\n${r.stderr}`;
const SOURCE_LINE = '出典: 試験用の調査 2025';
const src = (sourceLine: boolean) => `import {diagram, box, row, connect} from 'svg-diagram';
export default () => {
  const d = diagram({theme: 'blue', title: '試験図'${sourceLine ? `, sourceLine: '${SOURCE_LINE}'` : ''}});
  d.add(row([box({id: 'a', title: '入口'}), box({id: 'b', title: '出口'})]), connect('a:right', 'b:left'));
  return d;
};
`;
const project = () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'no-source-line-'));
  fs.mkdirSync(path.join(dir, 'src'));
  fs.writeFileSync(path.join(dir, 'src', 'with.ts'), src(true));
  fs.writeFileSync(path.join(dir, 'src', 'without.ts'), src(false));
  return dir;
};
const read = (dir: string, name: string) => fs.readFileSync(path.join(dir, 'svg', `${name}.svg`), 'utf8');
const meta = (svg: string) => JSON.parse((/<metadata id="svg-diagram">([^<]*)<\/metadata>/.exec(svg) as RegExpExecArray)[1]!.replace(/&quot;/g, '"'));
const noMeta = (svg: string) => svg.replace(/\n?\s*<metadata id="svg-diagram">[^<]*<\/metadata>/, '');
const heightOf = (svg: string) => Number(/<svg [^>]*height="(\d+(?:\.\d+)?)"/.exec(svg)?.[1]);

test('build --no-source-line: same SVG as a source without sourceLine; the flag is recorded only when used', () => {
  const dir = project();
  assert.equal(run('build-diagram.ts', dir, 'src/with.ts', 'src/without.ts', '--no-lint').status, 0);
  const plainWith = read(dir, 'with'), plainWithout = read(dir, 'without');
  assert.ok(plainWith.includes(SOURCE_LINE));
  assert.equal(meta(plainWith).noSourceLine, undefined, 'no key without the flag');
  const r = run('build-diagram.ts', dir, 'src/with.ts', '--no-lint', '--no-source-line', '--out', 'flagged.svg');
  assert.equal(r.status, 0, text(r));
  const flagged = fs.readFileSync(path.join(dir, 'flagged.svg'), 'utf8');
  assert.ok(!flagged.includes(SOURCE_LINE));
  assert.equal(meta(flagged).noSourceLine, true);
  assert.equal(noMeta(flagged), noMeta(plainWithout), 'identical to drawing a source that never had a sourceLine');
  assert.ok(heightOf(flagged) < heightOf(plainWith), 'the source line took height');
  // a figure without sourceLine: the flag changes nothing but the metadata
  run('build-diagram.ts', dir, 'src/without.ts', '--no-lint', '--no-source-line', '--out', 'flagged2.svg');
  assert.equal(noMeta(fs.readFileSync(path.join(dir, 'flagged2.svg'), 'utf8')), noMeta(plainWithout));
});

test('build --stale: a different flag regenerates, the same flag skips', () => {
  const dir = project();
  const stale = (...f: string[]) => text(run('build-diagram.ts', dir, 'src/with.ts', '--no-lint', '--stale', ...f));
  assert.match(stale(), /1 件を生成/);
  assert.match(stale(), /最新（スキップ）/);
  assert.match(stale('--no-source-line'), /1 件を生成/, 'was built with the line');
  assert.ok(!read(dir, 'with').includes(SOURCE_LINE));
  assert.match(stale('--no-source-line'), /最新（スキップ）/);
  assert.match(stale(), /1 件を生成/, 'was built without the line');
  assert.ok(read(dir, 'with').includes(SOURCE_LINE));
});

test('check --drift --rebuild: an SVG built with the flag matches; a plain rebuild of it would not', () => {
  const dir = project();
  run('build-diagram.ts', dir, 'src/with.ts', '--no-lint', '--no-source-line');
  const ok = run('check-diagram.ts', dir, '--drift', '--rebuild', 'src/with.ts');
  assert.equal(ok.status, 0, text(ok));
  // forge the metadata: the same picture, but claiming a plain build -> the rebuild draws the line and differs
  const f = path.join(dir, 'svg', 'with.svg');
  fs.writeFileSync(f, fs.readFileSync(f, 'utf8').replace(/,"noSourceLine":true/, ''));
  const bad = run('check-diagram.ts', dir, '--drift', '--rebuild', 'src/with.ts');
  assert.notEqual(bad.status, 0, text(bad));
  assert.match(text(bad), /一致しない/);
});

test('renderSource({noSourceLine}): no source-line text, the file untouched, default unchanged', async () => {
  const dir = project();
  const file = path.join(dir, 'src', 'with.ts');
  const before = fs.readFileSync(file, 'utf8');
  const on = await renderSource(file, {noSourceLine: true});
  const off = await renderSource(file);
  const without = await renderSource(path.join(dir, 'src', 'without.ts'));
  assert.ok(!on.svg.includes(SOURCE_LINE));
  assert.ok(off.svg.includes(SOURCE_LINE));
  assert.equal(on.svg, without.svg);
  assert.ok(on.height < off.height);
  assert.equal(fs.readFileSync(file, 'utf8'), before);
});

test('deck --no-source-line: .ts is drawn without the line; an .svg input draws a warning', () => {
  const dir = project();
  run('build-diagram.ts', dir, 'src/with.ts', '--no-lint');
  const r = run('deck-diagram.ts', dir, 'src/with.ts', 'svg/with.svg', '--no-source-line', '--out', 'd.html');
  assert.equal(r.status, 0, text(r));
  assert.match(r.stderr, /svg\/with\.svg: \.svg の出典行は消えない/);
  const html = fs.readFileSync(path.join(dir, 'd.html'), 'utf8');
  assert.equal(html.split(SOURCE_LINE).length - 1, 1, 'only the baked .svg keeps it');
});
