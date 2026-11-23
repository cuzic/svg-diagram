import assert from 'node:assert/strict';
import {test} from 'node:test';
import {band, copyBand, DEF, DEF_API, defOf, plain} from '../lib/band-def.ts';
import type {BandDef, BandValue} from '../lib/band-def.ts';
import {detachData, diagram} from '../lib/dsl/diagram.ts';
import {cloneBand} from '../lib/dsl/shared.ts';
import {box, group} from '../lib/dsl/text-bands.ts';
import {SOURCE, SourceRef, withSource} from '../lib/source-ref.ts';
import type {BoxBand} from '../lib/types/text-bands.ts';

const boxDef = {
  type: 'box',
  layout(_data, {x, y, w}) { return {h: 8, laid: {x, y, w, h: 8}}; },
  emit() { return ''; },
} satisfies BandDef<BoxBand>;

test('band attaches an enumerable own definition without changing its input', () => {
  const data = box({title: 'Box'});
  const value: BandValue<'box'> = band(boxDef, data);
  assert.equal(DEF_API, '0.1');
  assert.equal(DEF, Symbol.for('svg-diagram.def/0.1'));
  assert.notEqual(value, data);
  assert.equal(Object.getOwnPropertyDescriptor(value, DEF)?.enumerable, true);
  assert.equal(defOf(value), boxDef);
  assert.equal(Object.hasOwn(data, DEF), false);
  assert.throws(() => band({...boxDef, type: 'other'}, data), /other.*box/);
});

test('spreading preserves DEF and copyBand preserves property descriptors and prototype', () => {
  const value = band(boxDef, box({title: 'Box'}));
  const proto = {example: true};
  Object.setPrototypeOf(value, proto);
  Object.defineProperty(value, 'handle', {value: 'box:right'});
  assert.equal({...value, x: 1}[DEF], boxDef);
  for (const copy of [copyBand, cloneBand]) {
    const cloned = copy(value);
    assert.notEqual(cloned, value);
    assert.equal(cloned[DEF], boxDef);
    assert.equal(Object.getPrototypeOf(cloned), proto);
    assert.deepEqual(Object.getOwnPropertyDescriptors(cloned), Object.getOwnPropertyDescriptors(value));
  }
});

test('detachData preserves the definition by reference on nested copies', () => {
  const value = band(boxDef, box({title: 'Box'}));
  const data = diagram({theme: 'blue'}).add(group([group([value])]));
  const outer = detachData(data).bands[0];
  assert.equal(outer?.type, 'group');
  const inner = outer.children[0];
  assert.equal(inner?.type, 'group');
  const cloned = inner.children[0];
  assert.ok(cloned);
  assert.notEqual(cloned, value);
  assert.equal(defOf(cloned), boxDef);
  assert.equal(Object.getOwnPropertyDescriptor(cloned, DEF)?.enumerable, true);
});

test('plain strips every version of DEF recursively and keeps other symbols', () => {
  const other = Symbol.for('svg-diagram.def/9.9');
  const source = new SourceRef(undefined, 'bands[0]');
  const value = withSource(band(boxDef, box({title: 'Box'})), source);
  const leaf = {[other]: boxDef, value};
  const symbolChildren = Symbol('children');
  const map = new Map([['band', value]]);
  const children = Object.assign([leaf], {[DEF]: boxDef});
  const tree = {children: [{children}], [symbolChildren]: [leaf], map};
  const result = plain(tree);
  const expectedLeaf = {value: {...box({title: 'Box'}), [SOURCE]: source}};
  assert.deepEqual(result, {children: [{children: [expectedLeaf]}], [symbolChildren]: [expectedLeaf], map});
  assert.notEqual(result, tree);
  assert.notEqual(result.children[0]?.children[0], leaf);
  assert.equal(result.map, map);
  assert.equal(result.children[0]?.children[0]?.value[SOURCE], source);
  assert.equal(value[DEF], boxDef);
  assert.equal(leaf[other], boxDef);
});

test('defOf rejects a different DEF version even when the current one is present', () => {
  const key = Symbol.for('svg-diagram.def/9.9');
  assert.equal(defOf({type: 'box'}), undefined);
  for (const value of [{[key]: boxDef}, {[DEF]: boxDef, [key]: boxDef}]) {
    assert.throws(() => defOf(value), /(?=.*svg-diagram\.def\/9\.9)(?=.*svg-diagram\.def\/0\.1)/);
  }
});
