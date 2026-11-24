import assert from 'node:assert/strict';
import {test} from 'node:test';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import {verifyWithServices} from '../lib/verify-core.ts';
import {box, diagram, renderInBrowser} from '../lib/web.ts';

test('the shared verification stage bundles without the full verifier and rule catalog', async () => {
  const {metafile} = await build({entryPoints: [fileURLToPath(new URL('../lib/verify-core.ts', import.meta.url))],
    bundle: true, platform: 'browser', write: false, metafile: true});
  const forbidden = ['/verify-handlers.ts', '/rules.ts', '/band-children.ts'];
  const found = Object.keys(metafile.inputs).filter(file => forbidden.some(suffix => file.endsWith(suffix)));
  assert.deepEqual(found, []);
});

test('verification uses only the supplied band checks and runs them for both appearances', async () => {
  const input = diagram({theme: 'blue', legend: false, appearance: 'auto'}).add(box({title: 'Review'}));
  const {laidOut} = await renderInBrowser(input, {measure: ({text, size}) => ({w: text.length * size / 2, h: size})});
  const appearances: string[] = [];
  const verdict = verifyWithServices({
    collectRects: () => [{id: null, label: 'out of bounds', x: -10, y: 0, w: 10, h: 10}],
    checkFigures: d => {
      appearances.push(String(d.appearance));
      return {issues: [{message: 'Band issue'}], warnings: ['Band warning']};
    },
    contrastProblems: () => [],
    lintDiagram: () => [],
    acceptHint: () => '',
    mergeFindingSides: () => [],
    hasMutedBox: () => false,
  }, laidOut);
  assert.deepEqual(appearances, ['light', 'dark']);
  assert.equal(verdict.ok, false);
  assert.equal(verdict.problems.length, 2);
  assert.equal(verdict.problems[0], 'Band issue');
  assert.match(verdict.problems[1] ?? '', /out of bounds.*exceeds/);
  assert.deepEqual(verdict.warnings, ['Band warning']);
});
