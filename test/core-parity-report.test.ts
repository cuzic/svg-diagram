import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync, readFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {test} from 'node:test';

test('the parity report writes a Markdown comparison of three examples', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'core-parity-'));
  try {
    const out = path.join(dir, 'report.md');
    const examples = ['examples/canvas-swot.ts', 'examples/image-spotlight.ts', 'examples/width-fit.ts'];
    const run = (...args: string[]) => execFileSync(process.execPath, ['scripts/core-parity-report.ts', ...args, ...examples], {
      cwd: path.resolve(import.meta.dirname, '..'), encoding: 'utf8',
    });
    const stdout = run();
    assert.match(stdout, /作例数 3/);
    assert.match(stdout, /\| canvas-swot\.ts \| 描画可 \| 描画可 \|/);
    assert.match(stdout, /\| image-spotlight\.ts \| 描画可 \| 描画可 \| spotlight \|/);
    assert.match(stdout, /\| width-fit\.ts \| 描画可 \| 描画可 \| — \| (?:同一|差あり) \| 0 \| 0 \|/);
    assert.equal(run('--out', out), '');
    assert.equal(readFileSync(out, 'utf8'), stdout);
  } finally {
    rmSync(dir, {recursive: true, force: true});
  }
});
