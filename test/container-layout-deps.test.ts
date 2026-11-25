import assert from 'node:assert/strict';
import {test} from 'node:test';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import {parseRef} from '../lib/connect-geometry.ts';
import {registerRowSlots} from '../lib/layout-row.ts';
import type {Rect} from '../lib/types/core.ts';

test('bundling one container handler does not bring in the other handlers', async () => {
  const modules = ['layout-row', 'layout-grid', 'layout-connect'];
  for (const name of modules) {
    const {metafile} = await build({entryPoints: [fileURLToPath(new URL(`../lib/${name}.ts`, import.meta.url))],
      bundle: true, platform: 'browser', metafile: true, write: false});
    const forbidden = [...modules.filter(module => module !== name), 'band-children', 'rules', 'verify-handlers', 'emit-handlers'];
    const present = Object.keys(metafile.inputs).filter(file => forbidden.some(module => file.endsWith(`/${module}.ts`)));
    assert.deepEqual(present, [], name);
  }
});

test('row slots register anchor ranges for connectors without any layout table', () => {
  assert.deepEqual(parseRef('plan#1-2:right@0.25'), {id: 'plan#1-2', side: 'right', at: 0.25});
  const anchors = new Map<string, Rect>();
  const areaIds = new Set<string>();
  const ctx = {anchors, areaIds, claimed: (id: string): never => { throw new Error(id); }};
  const band = {gap: 16, children: []};
  const placed = [{x: 20, y: 24, w: 100, h: 40}, {x: 136, y: 24, w: 100, h: 40}];
  registerRowSlots(ctx, 'plan', band, 24, 40, 20, 216, 16, placed);
  assert.deepEqual(anchors.get('plan#1-2'), {x: 20, y: 24, w: 216, h: 40});
  assert.equal(areaIds.has('plan#1-2'), true);
  assert.throws(() => registerRowSlots(ctx, 'plan', band, 24, 40, 20, 216, 16, placed), /plan/);
});
