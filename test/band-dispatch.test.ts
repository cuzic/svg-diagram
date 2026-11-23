import assert from 'node:assert/strict';
import {test} from 'node:test';
import {band} from '../lib/band-def.ts';
import type {BandDef} from '../lib/band-def.ts';
import {assertNoShadowedRows, coreDispatch, withLegacyTables} from '../lib/band-dispatch.ts';
import {CHILD_BANDS} from '../lib/band-children.ts';
import {box, group} from '../lib/dsl/text-bands.ts';
import {diagram} from '../lib/dsl/diagram.ts';
import {EMIT_HANDLERS} from '../lib/emit-handlers.ts';
import {layoutWith} from '../lib/layout.ts';
import {LAYOUT_HANDLERS, layoutHandlerFor} from '../lib/layout-handlers.ts';
import {MEASURE_HANDLERS} from '../lib/layout-measure.ts';
import {MIGRATED_TYPES} from '../lib/migrated.ts';
import {ROLES} from '../lib/tokens.ts';
import type {Band} from '../lib/types/index.ts';

const def = {
  type: 'zzz',
  layout(_data, {x, y, w}) { return {h: 8, laid: {x, y, w, h: 8}}; },
  emit() { return ''; },
} satisfies BandDef;
const data = {type: 'zzz'};
const f = () => 1;
const g = () => 2;

test('coreDispatch returns the definition hook and names bands without a definition', () => {
  assert.throws(() => coreDispatch.hook(data, 'layout'), /"zzz".*import/);
  assert.equal(coreDispatch.hook(band(def, data), 'layout'), def.layout);
});

test('withLegacyTables snapshots the injected rows without changing or sharing dispatches', () => {
  const base = coreDispatch;
  const tables = {layout: {zzz: f}};
  const d = withLegacyTables(base, tables);
  const other = withLegacyTables(base, {layout: {zzz: g}});
  assert.notEqual(d, base);
  assert.equal(tables.layout.zzz, f);
  assert.equal(d.hook(data, 'layout'), f);
  assert.equal(other.hook(data, 'layout'), g);
  assert.throws(() => base.hook(data, 'layout'), /"zzz".*import/);

  tables.layout.zzz = g;
  tables.layout = {zzz: g};
  assert.equal(d.hook(data, 'layout'), f);
  assert.throws(() => d.hook({type: 'toString'}, 'layout'), /"toString".*import/);
});

test('a definition hook takes precedence over the legacy row', () => {
  const d = withLegacyTables(coreDispatch, {layout: {zzz: f}, measure: {zzz: g}});
  const value = band(def, data);
  assert.equal(d.hook(value, 'layout'), def.layout);
  assert.equal(d.hook(value, 'measure'), g);
});

test('assertNoShadowedRows identifies migrated types left in legacy tables', () => {
  assert.throws(() => assertNoShadowedRows(['x'], {layout: {x: f}}), /"x".*layout/);
  assert.doesNotThrow(() => assertNoShadowedRows(['x'], {layout: {y: f}}));
  assert.doesNotThrow(() => assertNoShadowedRows(['toString'], {layout: {y: f}}));
  assertNoShadowedRows(MIGRATED_TYPES, {
    layout: LAYOUT_HANDLERS,
    measure: MEASURE_HANDLERS,
    emit: Object.fromEntries(Object.entries(EMIT_HANDLERS).map(([type, row]) => [type, row.render])),
    children: CHILD_BANDS,
  });
});

test('layout resolves every legacy row and rejects unknown types instead of laying out a box', () => {
  for (const [type, handler] of Object.entries(LAYOUT_HANDLERS)) {
    assert.equal(layoutHandlerFor({type}), handler, type);
  }
  const unknown = {type: 'x:y'} as unknown as Band;
  const d = diagram({theme: 'blue'});
  assert.throws(() => layoutHandlerFor(unknown), /"x:y".*import/);
  for (const value of [unknown, group([unknown])]) {
    assert.throws(() => layoutWith({...d, bands: [value]}, ROLES, () => 0), /"x:y".*import/);
  }
});

test('layout uses an internal definition attached to the band value', () => {
  const boxDef = {
    type: 'box',
    internal: true,
    layout(_band, ctx) { ctx.y += 8 + ctx.d.gap; },
    emit() { return ''; },
  } satisfies BandDef<ReturnType<typeof box>>;
  const value = band(boxDef, box({title: 'Box'}));
  assert.equal(layoutHandlerFor(value), boxDef.layout);
  const d = diagram({theme: 'blue'});
  const out = layoutWith({...d, bands: [value]}, ROLES, () => 0);
  assert.equal(out.canvasHeight, 2 * d.pad + 8);
  assert.deepEqual(out.laidOut, []);
});
