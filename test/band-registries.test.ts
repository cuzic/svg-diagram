import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CHILD_BANDS, STACK_WIDTH, childrenOf, nestedBandsOf, stackWidthOf} from '../lib/band-children.ts';
import {FULL_DEFINITIONS, UNDEFINED_BANDS} from '../lib/full-definitions.ts';
import {renderInBrowser, diagram, box, group, legend} from '../lib/web.ts';
import {TEXT_RUNS} from '../lib/layout-text.ts';
import type {Band} from '../lib/types/index.ts';

// The compile-time half is each table's `satisfies` over Band['type']; this is the run-time half: the tables cover the same types.
test('every per-band-type registry has an entry for every band type', () => {
  const types = [...Object.keys(FULL_DEFINITIONS), ...Object.keys(UNDEFINED_BANDS)].sort();
  for (const [name, table] of Object.entries({CHILD_BANDS, STACK_WIDTH})) {
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


test('renderInBrowser measures nested bands and group labels', async () => {
  const data = diagram({theme: 'blue', title: 't'}).add(
    group([box({title: 'Inner', body: 'text'})], {title: 'Frame', stamp: 'Draft'}),
    legend([{tone: 'accent', label: 'Legend'}]),
  );
  const texts = new Set<string>();
  await renderInBrowser(data, {measure: ({text, size}) => {
    texts.add(text);
    return {w: text.length * size / 2, h: size};
  }});
  for (const text of ['Frame', 'Draft', 'Inner', 'text', 'Legend']) assert.ok(texts.has(text), text);
});
