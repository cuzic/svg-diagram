import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {LAYOUT_HANDLERS} from '../lib/layout-handlers.ts';
import {CHILD_BANDS, STACK_WIDTH, childrenOf, nestedBandsOf, stackWidthOf} from '../lib/band-children.ts';
import {MEASURE_HANDLERS, collectMeasures} from '../lib/layout-measure.ts';
import {TEXT_RUNS} from '../lib/layout-text.ts';
import {ROLES} from '../lib/tokens.ts';
import type {DiagramData} from '../lib/types/core.ts';
import type {Band} from '../lib/types/index.ts';

// The compile-time half is each table's `satisfies` over Band['type']; this is the run-time half: the tables cover the same types.
test('every per-band-type registry has an entry for every band type', () => {
  const types = Object.keys(LAYOUT_HANDLERS).sort();
  for (const [name, table] of Object.entries({CHILD_BANDS, STACK_WIDTH, MEASURE_HANDLERS})) {
    assert.deepEqual(Object.keys(table).sort(), types, name);
    for (const [type, fn] of Object.entries(table)) assert.equal(typeof fn, 'function', `${name}.${type}`);
  }
  assert.deepEqual(Object.keys(TEXT_RUNS).sort(), ['banner', 'box', 'caption']);
});

test('childrenOf / nestedBandsOf follow the bands a band holds', () => {
  const box: Band = {type: 'box', title: 'a'} as Band;
  const group = {type: 'group', children: [box]} as unknown as Band;
  const row = {type: 'row', children: [box, box]} as unknown as Band;
  const lane = {type: 'swimlane', steps: [box], lanes: []} as unknown as Band;
  const image = {type: 'image', children: [box]} as unknown as Band;
  assert.deepEqual(childrenOf(group), [box]);
  assert.equal(childrenOf(row).length, 2);
  assert.deepEqual(childrenOf(lane), []);
  assert.deepEqual(nestedBandsOf(lane), [box]);
  assert.deepEqual(childrenOf({type: 'image'} as unknown as Band), []);
  assert.equal(childrenOf(image).length, 1);
  assert.equal(childrenOf(box).length, 0);
  assert.equal(stackWidthOf({type: 'group', pad: 10, children: []} as unknown as Band, 500), 480);
  assert.equal(stackWidthOf(row, 500), null);
});

test('collectMeasures registers the atoms of nested bands and of the stamp / title of a group', () => {
  const data = {width: 800, pad: 20, gap: 10, bands: [
    {type: 'group', title: 'Frame', stamp: 'Draft', children: [{type: 'box', title: 'Inner', body: 'text'}]},
    {type: 'legend', items: [{label: 'Legend'}]},
  ]} as unknown as DiagramData;
  const texts = new Set([...collectMeasures(data, ROLES).values()].map(r => r.text));
  for (const t of ['Frame', 'Draft', 'Inner', 'text', 'Legend']) assert.ok(texts.has(t), t);
});

test('layout-handlers.ts does not import layout.ts (no import cycle)', () => {
  assert.doesNotMatch(readFileSync(new URL('../lib/layout-handlers.ts', import.meta.url), 'utf8'), /from '\.\/layout\.ts'/);
});
