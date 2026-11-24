import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {build} from 'esbuild';
import {diagram} from '../lib/dsl/diagram.ts';
import {box} from '../lib/dsl/box.ts';
import {layoutWith} from '../lib/layout.ts';
import {createLayoutWith} from '../lib/layout-core.ts';
import {collectMeasures, MEASURE_HANDLERS} from '../lib/layout-measure.ts';
import {createMeasureCollector} from '../lib/measure-core.ts';
import {LAYOUT_HANDLERS, layoutHandlerFor} from '../lib/layout-handlers.ts';
import {ROLES} from '../lib/tokens.ts';

test('layout and measurement bundle independently of the legacy band tables', async () => {
  const {metafile} = await build({
    entryPoints: ['layout-core', 'measure-core'].map(name => new URL(`../lib/${name}.ts`, import.meta.url).pathname),
    outdir: 'out',
    bundle: true, platform: 'browser', write: false, metafile: true,
  });
  assert.ok(Object.keys(metafile.inputs).every(file => !file.endsWith('/layout-handlers.ts') && !file.endsWith('/layout-measure.ts')));
});

test('layout resolution is local to one layout function', () => {
  const data = diagram({theme: 'blue'}).add(box({title: 'Review'}));
  const widthOf = (text: string) => text.length * 9;
  const seen: string[] = [];
  const tracking = createLayoutWith(band => {
    seen.push(band.type);
    return layoutHandlerFor(band);
  });
  const failing = createLayoutWith(() => { throw new Error('test resolver'); });
  assert.throws(() => failing(data, ROLES, widthOf), /test resolver/);
  assert.deepEqual(tracking(data, ROLES, widthOf), layoutWith(data, ROLES, widthOf));
  assert.deepEqual(seen, ['box']);
});

test('the checklist contains every band represented in the full layout table', async () => {
  const md = await readFile(new URL('../docs/tree-shaking-checklist.md', import.meta.url), 'utf8');
  const listed = [...md.matchAll(/^- \[[ x]\] `(\w+)`(?:（[^\n]*）)?$/gm)].map(match => match[1]);
  assert.deepEqual(listed.sort(), Object.keys(LAYOUT_HANDLERS).sort());
});

test('measurement resolves handlers per diagram without changing the request set', () => {
  const data = diagram({theme: 'blue'}).add(box({title: 'Review'}));
  const seen: string[] = [];
  const collect = createMeasureCollector(band => {
    seen.push(band.type);
    assert.equal(band.type, 'box');
    return MEASURE_HANDLERS.box;
  });
  assert.deepEqual(collect(data, ROLES), collectMeasures(data, ROLES));
  assert.deepEqual(seen, ['box']);
});
