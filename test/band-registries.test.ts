import {test} from 'node:test';
import assert from 'node:assert/strict';
import type {BandDef} from '../lib/band-def.ts';
import {childrenOf, nestedBandsOf} from '../lib/band-children.ts';
import {FULL_DEFINITIONS, UNDEFINED_BANDS, definitionOfBand, walkAnyBands} from '../lib/full-definitions.ts';
import {renderInBrowser, diagram, box, group, legend} from '../lib/web.ts';
import {TEXT_RUNS} from '../lib/layout-text.ts';
import {definitionKey, definitionsOf} from '../lib/figure-definitions.ts';
import {walkBands} from '../lib/legend-notation.ts';
import {holdsChildren, located} from '../lib/located.ts';
import type {Band} from '../lib/types/index.ts';

// Every built-in definition answers for its placed type: it draws, and it is found again from a placed band.
test('every built-in band definition emits, and the registered children hook is a function when present', () => {
  const types = [...Object.keys(FULL_DEFINITIONS), ...Object.keys(UNDEFINED_BANDS)].sort();
  for (const type of types) {
    const entry = FULL_DEFINITIONS[type as keyof typeof FULL_DEFINITIONS] as BandDef | ((data: never) => BandDef);
    if (typeof entry === 'function') continue;
    assert.equal(entry.type, type);
    assert.equal(typeof entry.emit, 'function', type);
    for (const hook of [entry.children, entry.stackWidth, entry.textSizes, entry.verify?.rects]) assert.ok(hook === undefined || typeof hook === 'function', type);
  }
  assert.deepEqual(Object.keys(TEXT_RUNS).sort(), ['banner', 'box', 'caption']);
});

test('childrenOf / nestedBandsOf follow the bands a band holds', () => {
  const box: Band = {type: 'box', title: 'a'} as Band;
  const group = {type: 'group', children: [box]} as unknown as Band;
  const row = {type: 'row', children: [box, box]} as unknown as Band;
  const lane = {type: 'swimlane', steps: [box], lanes: []} as unknown as Band;
  const image = {type: 'image', children: [box]} as unknown as Band;
  const full = definitionOfBand;
  assert.deepEqual(childrenOf(group, full), [box]);
  assert.equal(childrenOf(row, full).length, 2);
  assert.deepEqual(childrenOf(lane, full), []);
  assert.deepEqual(nestedBandsOf(lane, full), [box]);
  assert.deepEqual(childrenOf({type: 'image'} as unknown as Band, full), []);
  assert.equal(childrenOf(image, full).length, 1);
  assert.equal(childrenOf(box, full).length, 0);
  assert.equal(definitionOfBand(group)?.stackWidth?.(group as never, 500), 468);
  assert.equal(definitionOfBand(row)?.stackWidth, undefined);
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

test('walkAnyBands finds the bands nested in plain data, and located marks them with the call of the builder', () => {
  const inner = {type: 'box', title: 'a'} as unknown as Band;
  const outer = {type: 'group', children: [{type: 'row', children: [inner]}]} as unknown as Band;
  assert.equal(walkAnyBands([outer]).length, 3);
  assert.deepEqual(walkAnyBands([outer]).at(-1), inner);
  // a definition-less band is walked only through the resolver it is given
  const group = (parts: Band[]) => ({type: 'group', children: parts}) as unknown as Band;
  assert.equal(located(group, () => undefined)([inner]).type, 'group');
  assert.equal(located(group, definitionOfBand)([inner]).type, 'group');
  assert.deepEqual(holdsChildren(outer)?.children?.(outer as never), [(outer as unknown as {children: Band[]}).children[0]]);
  assert.equal(holdsChildren(inner), undefined);
});

test('definitions are found again from the bands a figure was made of', async () => {
  const data = diagram({theme: 'blue', title: 't'}).add(group([box({title: 'Inner'})], {title: 'Frame'}));
  const {laidOut} = await renderInBrowser(data, {measure: ({text, size}) => ({w: text.length * size / 2, h: size})});
  assert.equal(definitionKey(laidOut.laidOut[0] as never), laidOut.laidOut[0]?.type);
  assert.equal(definitionKey({type: 'chart', kind: 'sankey'} as never), 'chart:sankey');
  const found = definitionsOf(laidOut.bands)(laidOut.laidOut.find(band => band.type === 'box') as never);
  assert.equal(found?.type, 'box');
  // without definitions on the bands there is nothing to find; a walk follows the definitions it is given
  assert.equal(definitionsOf([])(laidOut.laidOut[0] as never), undefined);
  assert.equal(walkBands([{type: 'group', children: [{type: 'box'}]} as unknown as Band]).length, 1);
  assert.equal(walkBands([{type: 'group', children: [{type: 'box'}]} as unknown as Band], [], definitionOfBand).length, 2);
});
