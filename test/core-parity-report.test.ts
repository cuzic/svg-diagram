import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {test} from 'node:test';
import {slideCacheKeyForTest} from './helpers/slide-fixture.ts';

const root = path.resolve(import.meta.dirname, '..');

test('the parity report writes a Markdown comparison of three examples', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'core-parity-'));
  try {
    const out = path.join(dir, 'report.md');
    const examples = ['examples/canvas-swot.ts', 'examples/image-spotlight.ts', 'examples/width-fit.ts'];
    const run = (...args: string[]) => execFileSync(process.execPath, ['scripts/core-parity-report.ts', ...args, ...examples], {
      cwd: root, encoding: 'utf8',
    });
    const stdout = run();
    assert.match(stdout, /作例数 3/);
    assert.match(stdout, /\| canvas-swot\.ts \| 描画可 \| 描画可 \|/);
    assert.match(stdout, /\| image-spotlight\.ts \| 描画可 \| 描画可 \| — \| 同一 \| 0 \| 0 \|/);
    assert.match(stdout, /\| width-fit\.ts \| 描画可 \| 描画可 \| — \| (?:同一|差あり) \| 0 \| 0 \|/);
    assert.equal(run('--out', out), '');
    assert.equal(readFileSync(out, 'utf8'), stdout);
  } finally {
    rmSync(dir, {recursive: true, force: true});
  }
});

test('the parity report compares slide fill with a cached budget and with defaults', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'core-parity-slide-'));
  const cwd = process.cwd();
  try {
    process.chdir(dir);
    slideCacheKeyForTest(dir, {maxHeight: 450, contentWidth: 640});
    const source = `import {box, diagram} from ${JSON.stringify(new URL('../lib/dsl-pure.ts', import.meta.url).href)};
      export default () => diagram({day: 2, width: 500, slide: {page: 'pages/p.md', heading: '見出し'}, fill: true})
        .add(box({title: 'Review', body: 'Plan'}));`;
    for (const name of ['p', 'uncached']) writeFileSync(`${name}.ts`, source);
    const report = execFileSync(process.execPath, [path.join(root, 'scripts/core-parity-report.ts'), 'p.ts', 'uncached.ts'], {
      cwd: dir, encoding: 'utf8',
    });
    for (const name of ['p', 'uncached']) {
      const row = report.split('\n').find(line => line.startsWith(`| ${name}.ts |`));
      assert.match(row ?? '', /描画可 \| 描画可 \| — \| (?:同一|差あり) \| 0 \| 0 \|/);
    }
  } finally {
    process.chdir(cwd);
    rmSync(dir, {recursive: true, force: true});
  }
});
