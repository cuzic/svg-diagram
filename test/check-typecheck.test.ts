import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const ROOT = path.resolve(import.meta.dirname, '..');
const BIN = path.join(ROOT, 'bin', 'svg-diagram');
const src = (opts: string) => `import {diagram, caption} from '${path.join(ROOT, 'lib', 'dsl.ts')}';\nexport default function define() { return diagram({theme: 'blue', title: 't'}).add(caption('x'${opts})); }\n`;

test('check --typecheck runs tsc too: a key the runtime ignores but the types refuse fails it; without the flag nothing reads the types', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'check-tc-'));
  fs.writeFileSync(path.join(dir, 'package.json'), '{"type":"module"}\n');
  assert.equal(spawnSync(BIN, ['init'], {cwd: dir, encoding: 'utf8'}).status, 0);
  fs.mkdirSync(path.join(dir, 'diagrams'));
  fs.writeFileSync(path.join(dir, 'diagrams', 'a.ts'), src(', {bogus: 1}'));
  const plain = spawnSync(BIN, ['check', 'diagrams/a.ts'], {cwd: dir, encoding: 'utf8'});
  assert.equal(plain.status, 0, plain.stdout + plain.stderr);
  const typed = spawnSync(BIN, ['check', '--typecheck', 'diagrams/a.ts'], {cwd: dir, encoding: 'utf8'});
  assert.equal(typed.status, 1);
  assert.match(typed.stdout + typed.stderr, /TS2353.*bogus/);
  fs.writeFileSync(path.join(dir, 'diagrams', 'a.ts'), src(''));
  const ok = spawnSync(BIN, ['check', '--typecheck', 'diagrams/a.ts'], {cwd: dir, encoding: 'utf8'});
  assert.equal(ok.status, 0, ok.stdout + ok.stderr);
  assert.match(ok.stdout, /✓ typecheck/);
});
