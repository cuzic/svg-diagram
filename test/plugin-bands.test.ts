import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {assertTrustedBandFields, band, defOf, EXTERNAL} from '../lib/band-def.ts';
import {BandError} from '../lib/band-error.ts';
import type {PluginDef} from '../lib/plugin.ts';
import {pluginBands} from '../lib/plugin-bands.ts';
import {captureSourceLocations, sourceOf} from '../lib/source-ref.ts';
import {diagram} from '../lib/dsl/diagram.ts';

const stars = {
  build(input: {rating: number}) { return {rating: input.rating}; },
  layout(_data, {x, y, w}) { return {h: 8, laid: {x, y, w, h: 8}}; },
  emit() { return ''; },
} satisfies PluginDef['bands'][string];

const plugin = {id: 'rating-demo', apiVersion: '0.1', bands: {stars}} satisfies PluginDef;

test('pluginBands builds data and attaches the namespaced, external definition', () => {
  const value = pluginBands(plugin).stars({rating: 4}, {id: 'r', scope: 'score', reveal: 2, until: 4});
  assert.equal(value.type, 'rating-demo:stars');
  assert.equal(value.id, 'r');
  assert.equal(value.scope, 'score');
  assert.equal(value.reveal, 2);
  assert.equal(value.until, 4);
  assert.ok('rating' in value);
  assert.equal(value.rating, 4);
  const def = defOf(value);
  assert.equal(def?.type, 'rating-demo:stars');
  assert.equal(def?.layout, stars.layout);
  assert.equal(def?.emit, stars.emit);
  assert.equal(def?.[EXTERNAL], true);
  assert.equal(EXTERNAL, Symbol.for('svg-diagram.external'));
  assert.equal(Object.hasOwn(stars, EXTERNAL), false);
  assert.equal(diagram({theme: 'blue'}).add(value).bands[0], value);
});

test('a build failure names the plugin and retains the original error', () => {
  const cause = new Error('rating が範囲外です');
  const broken = {...plugin, bands: {stars: {...stars, build() { throw cause; }}}};
  const makeStars = pluginBands(broken).stars;
  assert.throws(() => makeStars(undefined), error => {
    assert.ok(error instanceof BandError);
    assert.match(error.message, /^rating-demo.*rating が範囲外です/);
    assert.equal(error.plugin, 'rating-demo');
    assert.equal(error.kind, 'stars');
    assert.equal(error.phase, 'build');
    assert.equal(error.cause, cause);
    return true;
  });
});

test('external definitions cannot enable trusted-only fields', () => {
  for (const flags of [{internal: true}, {nodeIds: 'self'}, {rectsQualified: true}]) {
    const unsafe = {...plugin, bands: {stars: {...stars, ...flags}}};
    assert.throws(() => pluginBands(unsafe as unknown as PluginDef), {
      name: 'BandError', plugin: 'rating-demo', kind: 'stars', phase: 'definition',
    });
  }
  const type = 'rating-demo:stars';
  const namespaced = {
    type,
    layout() {},
    emit: stars.emit,
    internal: true as const,
  };
  assert.throws(() => band(namespaced, {type}), {
    name: 'BandError', plugin: 'rating-demo', kind: 'stars', phase: 'definition',
  });
  assert.doesNotThrow(() => assertTrustedBandFields({...namespaced, type: 'stars'}));
  assert.throws(() => assertTrustedBandFields({...namespaced, type: 'stars', [EXTERNAL]: true}), BandError);
});

test('plugins require a compatible API version and a valid, unreserved id', () => {
  assert.doesNotThrow(() => pluginBands({...plugin, apiVersion: '0.1.2'}));
  for (const apiVersion of ['0.2', '1.1', '0.1.bad', '0.01', '0']) {
    assert.throws(() => pluginBands({...plugin, apiVersion}), /rating-demo.*apiVersion/);
  }
  for (const id of ['Core', 'core', 'svg-diagram', '9rating', 'rating:demo']) {
    assert.throws(() => pluginBands({...plugin, id}), /id/);
  }
});

test('a plugin band captures its source at the builder call', () => {
  const makeStars = pluginBands(plugin).stars;
  captureSourceLocations(true);
  try {
    assert.ok(sourceOf(makeStars({rating: 4})));
  } finally {
    captureSourceLocations(false);
  }
});

test('svg-diagram/plugin is a type-only package entry', async () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.deepEqual(pkg.exports['./plugin'], {
    types: './dist/lib/plugin.d.ts',
    default: './dist/lib/plugin.js',
  });
  const entry: Record<string, unknown> = await import('../lib/plugin.ts');
  assert.deepEqual(Object.keys(entry), []);
});
