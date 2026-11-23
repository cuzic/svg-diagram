import assert from 'node:assert/strict';
import {mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import {test} from 'node:test';
import {auditSideEffects} from '../scripts/side-effects.ts';

const root = path.resolve(import.meta.dirname, '..');
const known: Record<string, {count: number; reason: string}> =
  JSON.parse(readFileSync(new URL('./fixtures/side-effects.json', import.meta.url), 'utf8'));
const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));

test('the side-effects inventory matches the TypeScript AST audit', () => {
  assert.deepEqual(auditSideEffects(root), new Map(Object.entries(known).map(([file, {count}]) => [file, count])));
  for (const {reason} of Object.values(known)) assert.ok(reason.trim());
});

test('the DOM event listeners in lib/present/ui.ts are in the inventory', () => {
  assert.ok(Object.hasOwn(known, 'lib/present/ui.ts'));
});

test('package.json sideEffects lists the dist paths from the inventory', () => {
  assert.ok(Array.isArray(pkg.sideEffects));
  assert.deepEqual(pkg.sideEffects, Object.keys(known).sort().map(file => `./dist/${file.replace(/\.ts$/, '.js')}`));
});

test('the AST audit counts executed expressions in published modules, including root CLI files', () => {
  const tmp = mkdtempSync(path.join(os.tmpdir(), 'side-effects-'));
  try {
    const lib = path.join(tmp, 'lib');
    const make = (file: string, source: string): void => writeFileSync(path.join(lib, file), source);
    writeFileSync(path.join(tmp, 'tsconfig.json'), '{"include":["*.ts","lib/*.ts"]}');
    mkdirSync(lib);
    const cli = path.join(tmp, 'cli.ts');
    writeFileSync(cli, "process.on('exit', () => {});");
    make('viewer.js', "document.addEventListener('click', () => {});");
    make('listener.ts', "globalThis.addEventListener('x', () => {})");
    make('initializer.ts', "export const x = Object.freeze({value: effect()})");
    make('control.ts', "if (condition) {}");
    make('await.ts', "const x = await value; export {}");
    make('class.ts', "export class C { static value = prepare(); }");
    make('template.ts', "const x = tag\x60value\x60;");
    make('pure.ts', "'use strict'; const x = Object.freeze({value: () => effect(), list: [1, /x/, new RegExp(\"x\")]}); const map = new Map();");
    const expected = new Map([
      ['cli.ts', 2], ['lib/await.ts', 1], ['lib/class.ts', 1], ['lib/control.ts', 1],
      ['lib/initializer.ts', 1], ['lib/listener.ts', 2], ['lib/template.ts', 1], ['lib/viewer.js', 2],
    ]);
    assert.deepEqual(auditSideEffects(tmp), expected);

    writeFileSync(cli, "import './lib/initializer.ts';\nprocess.on('exit', () => {});");
    expected.set('cli.ts', 3);
    assert.deepEqual(auditSideEffects(tmp), expected);
  } finally {
    rmSync(tmp, {recursive: true});
  }
});

test('the browser bundle check reports bytes and gzip and rejects a 1 KB budget', () => {
  const command = (env: NodeJS.ProcessEnv) =>
    spawnSync(process.execPath, ['scripts/bundle-size.ts'], {cwd: root, env, encoding: 'utf8'});
  const normal = command(process.env);
  assert.equal(normal.status, 0, normal.stderr);
  assert.match(normal.stdout, /gzip.*バイト/);
  assert.match(normal.stdout, /\.\/browser\s+\d+\s+\d+\s+\d+/);
  const tiny = command({...process.env, SVG_DIAGRAM_BROWSER_BUDGET_BYTES: '1024'});
  assert.equal(tiny.status, 1, tiny.stderr);
  assert.match(tiny.stdout, /\.\/browser\s+\d+\s+\d+\s+1024/);
  assert.match(tiny.stderr, /上限/);
});
