import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {addScoped, emptyScopes, unknownHint} from '../lib/scope-table.ts';

test('layout core bundles independently of the band tables', async () => {
  const {metafile} = await build({
    entryPoints: [new URL('../lib/layout-core.ts', import.meta.url).pathname],
    outdir: 'out',
    bundle: true, platform: 'browser', write: false, metafile: true,
  });
  const excluded = ['/quadrant.ts', '/band-children.ts', '/band-ids.ts', '/layout-connect.ts', '/layout-connect-gaps.ts', '/layout-box-like.ts', '/layout-caption-lines.ts', '/status.ts'];
  assert.ok(Object.keys(metafile.inputs).every(file => excluded.every(suffix => !file.endsWith(suffix))));
});

test('scope hints use the anchor data without walking any diagram bands', () => {
  const table = emptyScopes();
  addScoped(table, 'plan', 'node');
  assert.equal(unknownHint(table, 'old.node'), ' (did you mean "plan.node"?)');
  assert.equal(unknownHint(table, 'old.missing'), '');
});
