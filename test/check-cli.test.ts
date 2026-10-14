// node --test test/   — the check CLI's rule explanation, baseline and SARIF output.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const CLI = path.resolve(import.meta.dirname, '..', 'check-diagram.ts');
const run = (args: string[], cwd?: string) => spawnSync(process.execPath, [CLI, ...args], {encoding: 'utf8', cwd});

test('--explain prints a rule and how to accept it; an unknown rule suggests near ones', () => {
  const ok = run(['--explain', 'edge-crossings']);
  assert.equal(ok.status, 0);
  assert.match(ok.stdout, /edge-crossings/);
  assert.match(ok.stdout, /accept/);
  const bad = run(['--explain', 'edge']);
  assert.equal(bad.status, 2);
  assert.match(bad.stderr, /edge-crossings/);
  assert.match(run(['--rules']).stdout, /^graph-orphan-node\t/m);
});

test('--write-baseline records warnings; --baseline then reports only new ones, and sarif lists the rest', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'svgd-check-'));
  const lib = path.resolve(import.meta.dirname, '..', 'lib', 'dsl.ts');
  const src = path.join(dir, 'flow.ts');
  fs.writeFileSync(src, `import {diagram, box, connect} from ${JSON.stringify(lib)};
export default function define() {
  return diagram({theme: 'blue', title: 'flow'}).add(box({id: 'a', title: 'A'}), box({id: 'b', title: 'B'}), box({id: 'c', title: 'C'}), box({id: 'd', title: 'D'}), box({id: 'x', title: 'X'}), connect('a', 'b'), connect('b', 'c'), connect('c', 'd'));
}
`);
  const base = path.join(dir, 'baseline.json');
  const first = run(['--strict', src]);
  assert.equal(first.status, 1, first.stdout + first.stderr);
  assert.match(first.stdout, /graph-orphan-node/);
  assert.equal(run(['--write-baseline', base, src]).status, 0);
  const again = run(['--strict', '--baseline', base, src]);
  assert.equal(again.status, 0, again.stdout + again.stderr);
  assert.equal(JSON.parse(run(['--format', 'json', '--baseline', base, src]).stdout).warnings, 0);
  const sarif = JSON.parse(run(['--format', 'sarif', src]).stdout);
  assert.equal(sarif.version, '2.1.0');
  assert.ok(sarif.runs[0].results.some((r: {ruleId: string; level: string}) => r.ruleId === 'graph-orphan-node' && r.level === 'warning'));
  fs.rmSync(dir, {recursive: true, force: true});
});

test('--changed: only sources whose own file, imports or committed SVG changed; nothing changed checks nothing', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'svgd-changed-'));
  const lib = path.resolve(import.meta.dirname, '..', 'lib', 'dsl.ts');
  const src = (t: string, imp = '') => `import {diagram, box} from ${JSON.stringify(lib)};\n${imp}\nexport default function define() { return diagram({theme: 'blue', title: ${JSON.stringify(t)}}).add(box({title: ${JSON.stringify(t)}})); }\n`;
  fs.writeFileSync(path.join(dir, 'shared.ts'), 'export const x = 1;\n');
  fs.writeFileSync(path.join(dir, 'a.ts'), src('A'));
  fs.writeFileSync(path.join(dir, 'b.ts'), src('B', "import {x} from './shared.ts'; void x;"));
  fs.writeFileSync(path.join(dir, 'c.ts'), src('C'));
  const git = (...a: string[]) => spawnSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...a], {cwd: dir, encoding: 'utf8'});
  git('init', '-q'); git('add', '.'); git('commit', '-q', '-m', 'init');
  const none = run(['--changed=HEAD', 'a.ts', 'b.ts', 'c.ts'], dir);
  assert.equal(none.status, 0, none.stdout + none.stderr);
  assert.match(none.stdout, /3 件中 0 件/);
  assert.ok(!none.stdout.includes('✓'));
  fs.appendFileSync(path.join(dir, 'shared.ts'), 'export const y = 2;\n'); // b imports it
  fs.appendFileSync(path.join(dir, 'a.ts'), '// edit\n');
  const some = run(['--changed=HEAD', '--verbose', 'a.ts', 'b.ts', 'c.ts'], dir);
  assert.match(some.stdout, /3 件中 2 件/);
  assert.match(some.stdout, /✓ a\.ts/);
  assert.match(some.stdout, /✓ b\.ts/);
  assert.ok(!some.stdout.includes('✓ c.ts'));
  fs.writeFileSync(path.join(dir, '.svg-diagram.json'), '{}\n'); // an untracked config selects everything
  assert.match(run(['--changed=HEAD', 'a.ts', 'b.ts', 'c.ts'], dir).stdout, /3 件中 3 件/);
  assert.equal(run(['--changed'], dir).status, 2);
  fs.rmSync(dir, {recursive: true, force: true});
});
