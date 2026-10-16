// ADR 0022 U5: a draft figure says so in <desc> and <metadata>; check reports `draft-status` (info) and `--forbid-draft` makes it a warning.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const ROOT = path.resolve(import.meta.dirname, '..');
const cli = (script: string, cwd: string, ...args: string[]) => spawnSync(process.execPath, [path.join(ROOT, script), ...args], {cwd, encoding: 'utf8'});
const out = (r: ReturnType<typeof cli>) => `${r.stdout}\n${r.stderr}`;
const src = (opts: string) => `import {diagram, box, row} from 'svg-diagram';
export default () => diagram({theme: 'blue', title: '試験図', ${opts}}).add(row([box({id: 'a', title: '入口'}), box({id: 'b', title: '出口'})]));
`;
const project = () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'status-check-'));
  fs.mkdirSync(path.join(dir, 'src'));
  fs.writeFileSync(path.join(dir, 'src', 'draft.ts'), src("status: 'draft'"));
  fs.writeFileSync(path.join(dir, 'src', 'accepted.ts'), src("status: 'draft', accept: {'draft-status': '検討中の図'}"));
  fs.writeFileSync(path.join(dir, 'src', 'plain.ts'), src(''));
  return dir;
};
const findings = (r: ReturnType<typeof cli>): {rule: string; severity: string; file: string}[] => (JSON.parse(r.stdout) as {findings: {rule: string; severity: string; file: string}[]}).findings;
const draftOf = (r: ReturnType<typeof cli>, file: string) => findings(r).find(f => f.rule === 'draft-status' && f.file.endsWith(file));

test('check: draft-status is info, never fails --strict; a figure without a status has none', () => {
  const dir = project();
  const r = cli('check-diagram.ts', dir, '--strict', '--format', 'json', 'src/draft.ts', 'src/plain.ts');
  assert.equal(r.status, 0, out(r));
  assert.equal(draftOf(r, 'draft.ts')?.severity, 'info');
  assert.equal(draftOf(r, 'plain.ts'), undefined);
});

test('check --forbid-draft: the draft is a warning (so --strict fails), an accepted one stays info', () => {
  const dir = project();
  const warn = cli('check-diagram.ts', dir, '--forbid-draft', '--format', 'json', 'src/draft.ts');
  assert.equal(warn.status, 0, 'a warning alone does not fail');
  assert.equal(draftOf(warn, 'draft.ts')?.severity, 'warn');
  const strict = cli('check-diagram.ts', dir, '--strict', '--forbid-draft', 'src/draft.ts');
  assert.equal(strict.status, 1, out(strict));
  const accepted = cli('check-diagram.ts', dir, '--strict', '--forbid-draft', '--format', 'json', 'src/accepted.ts');
  assert.equal(accepted.status, 0, out(accepted));
  assert.equal(draftOf(accepted, 'accepted.ts')?.severity, 'info');
});

test('build: <desc> starts with the status, <metadata> carries it; a figure without a status has neither', () => {
  const dir = project();
  assert.equal(cli('build-diagram.ts', dir, 'src/draft.ts', 'src/plain.ts').status, 0);
  const draft = fs.readFileSync(path.join(dir, 'svg', 'draft.svg'), 'utf8'), plain = fs.readFileSync(path.join(dir, 'svg', 'plain.svg'), 'utf8');
  assert.match(draft, /<desc id="svg-desc">\(下書き\) 要素: 入口、出口<\/desc>/);
  assert.match(draft, /<title id="svg-title">試験図<\/title>/);
  assert.match(draft, /<metadata id="svg-diagram">[^<]*"status":"draft"/);
  assert.doesNotMatch(plain, /下書き|status/);
  assert.match(plain, /<desc id="svg-desc">要素: 入口、出口<\/desc>/);
});

test('check --drift --rebuild matches a draft figure it built', () => {
  const dir = project();
  assert.equal(cli('build-diagram.ts', dir, 'src/draft.ts').status, 0);
  const r = cli('check-diagram.ts', dir, '--drift', '--rebuild', 'src/draft.ts');
  assert.equal(r.status, 0, out(r));
});
