import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {assertTrustedBandFields, band, defOf, EXTERNAL} from '../lib/band-def.ts';
import {BandError} from '../lib/band-error.ts';
import type {PluginDef} from '../lib/plugin.ts';
import {pluginBands} from '../lib/plugin-bands.ts';
import {captureSourceLocations, sourceOf} from '../lib/source-ref.ts';
import {diagram} from '../lib/dsl/diagram.ts';
import {renderDiagram} from '../lib/dsl/render.ts';
import {renderInBrowser} from '../lib/web.ts';

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

test('a validated external definition stays frozen after construction', () => {
  const def = defOf(pluginBands(plugin).stars({rating: 4}));
  assert.ok(def);
  assert.equal(Object.isFrozen(def), true);
  assert.throws(() => Object.assign(def, {internal: true}), TypeError);
  assert.equal(def.internal, undefined);
  assert.equal(Object.isFrozen(stars), false);
});

test('plugin band kinds start with a lowercase letter and use lowercase letters, digits and hyphens', () => {
  for (const kind of ['a:b', 'Bad Kind', 'bad kind', 'aB', '9kind', '']) {
    assert.throws(() => pluginBands({...plugin, bands: {[kind]: stars}}), {
      name: 'BandError', plugin: 'rating-demo', kind, phase: 'definition',
    });
  }
  assert.equal(pluginBands({...plugin, bands: {'stars-2': stars}})['stars-2']({rating: 4}).type, 'rating-demo:stars-2');
});

test('plugin band builders omit absent options and retain defined zeroes', () => {
  const makeStars = pluginBands(plugin).stars;
  const input = {rating: 4};
  assert.deepEqual(Object.keys(makeStars(input)).sort(), ['rating', 'type']);
  const value = makeStars(input, {id: 'r', reveal: 0});
  assert.deepEqual(Object.keys(value).sort(), ['id', 'rating', 'reveal', 'type']);
  assert.equal(value.reveal, 0);
});

test('plugin build data cannot use host-owned band keys', () => {
  for (const field of ['type', 'id', 'scope', 'reveal', 'until']) {
    const makeStars = pluginBands({...plugin, bands: {stars: {...stars, build: () => ({[field]: undefined})}}}).stars;
    const expected = {
      name: 'BandError', plugin: 'rating-demo', kind: 'stars', phase: 'build',
      message: new RegExp(`rating-demo:stars.*${field}`),
    };
    assert.throws(() => makeStars(undefined, {id: 'r', scope: 'score', reveal: 2, until: 4}), expected);
    assert.throws(() => makeStars(undefined), expected);
  }
});

test('plugin build results must be plain objects', () => {
  for (const data of [null, 4, 'stars', undefined, [], new Date(), () => ({})]) {
    const broken = {...plugin, bands: {stars: {...stars, build: () => data}}} as unknown as PluginDef;
    const makeStars = pluginBands(broken)['stars'];
    assert.ok(makeStars);
    assert.throws(() => makeStars(undefined), {
      name: 'BandError', plugin: 'rating-demo', kind: 'stars', phase: 'build',
    });
  }
  const data = Object.assign(Object.create(null), {rating: 4});
  const makeStars = pluginBands({...plugin, bands: {stars: {...stars, build: () => data}}}).stars;
  assert.ok('rating' in makeStars(undefined));
});

test('Node and browser renderers report plugin bands whose drawing is deferred to U2–U3', async () => {
  const value = pluginBands(plugin).stars({rating: 4}, {id: 'r', scope: 'score'});
  const input = diagram({theme: 'blue'}).add(value);
  const expected = {
    name: 'BandError', plugin: 'rating-demo', kind: 'stars', phase: 'layout', message: /rating-demo:stars.*描画.*U2〜U3/,
  };
  await assert.rejects(renderDiagram(input, {name: 'rating.svg', budget: 'cacheOnly'}), expected);
  await assert.rejects(renderInBrowser(input, {measure: () => ({w: 0, h: 0})}), expected);
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
