import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as dsl from '../lib/dsl.ts';
import {located} from '../lib/located.ts';
import {installStackCapture, locateError} from '../lib/source-location-io.ts';
import {captureSourceLocations, sourceOf, withSource} from '../lib/source-ref.ts';

const nonBuilders = {
  analyzeCausalLoops: 'returns an analysis',
  analyzeCriticalPath: 'returns an analysis',
  build: 'writes files and returns a build result',
  cell: 'returns options for a table cell',
  checkDiagram: 'returns a check result',
  closeMeasurer: 'releases resources',
  fillScaleLimit: 'returns a number',
  isType: 'returns a predicate',
  renderDiagram: 'returns a render result',
  rewrite: 'restyles existing parts',
  speechBubble: 'returns a line of dialogue, not a band',
  stateRow: 'returns options for a state matrix row',
  styled: 'returns a builder',
  tally: 'returns a string',
  transitionUnits: 'returns data for causeTree',
  when: 'returns a predicate',
  within: 'returns a predicate',
  em: 'rich text helper',
  icon: 'icon registry',
  wf: 'wireframe node helpers',
};

const internalExports = {
  './compose/canvas.ts': {
    TEMPLATES: 'holds the region templates used by canvas',
    canvasBand: 'assembles the grid used by the public canvas builder',
    canvasKeys: 'lists template regions for validation and tests',
    canvasTemplates: 'lists template names for validation and tests',
  },
  './located.ts': {
    located: 'wraps the public builders',
  },
  './dsl/diagram.ts': {
    detachData: 'copies diagram data for the renderer',
    layoutFitted: 'lays out a diagram for the renderer',
  },
  './wireframe.ts': {
    collectScreenGridTextRequests: 'collects measurement requests for the screen grid',
    collectStateMatrixTextRequests: 'collects measurement requests for the state matrix',
    collectTextRequests: 'collects text measurement requests for layout',
    layoutScreenGrid: 'lays out a screen grid for the screen band',
    layoutScreens: 'lays out a collection of screens for rendering',
    layoutStateMatrix: 'lays out a state matrix for the screen band',
    layoutWireframe: 'lays out a wireframe for rendering',
  },
  './icon-registry.ts': {
    findManifest: 'looks up installed icon collections',
    glyphOf: 'looks up icon geometry for rendering',
    resolveIcon: 'resolves icon names for rendering',
  },
  './rich.ts': {
    RICH: 'marks rich text values internally',
    assertSolidText: 'validates band text options',
    assertSpans: 'validates rich text spans',
    richBoxFields: 'normalizes rich text options for boxes',
    richField: 'normalizes a rich text field',
    richOf: 'extracts rich text data for rendering',
  },
  './qc-table.ts': {
    checkSheetParts: 'assembles the bands of a check sheet',
    markOf: 'normalizes a matrix mark',
    matrixParts: 'assembles the bands of a matrix',
    matrixScores: 'calculates matrix scores for the matrix builder',
  },
};

test('located: capture is off by default and the original return value is preserved', t => {
  const capture = t.mock.method(Error, 'captureStackTrace', () => {});
  const value = {type: 'box'};
  const build = located((arg: typeof value) => arg);
  const returned = build(value);
  const publicBox = dsl.box({title: 'A'});
  assert.equal(capture.mock.callCount(), 0);
  assert.equal(returned, value);
  assert.equal(sourceOf(value), undefined);
  assert.equal(sourceOf(publicBox), undefined);
});

test('located: rewrite preserves the source of unchanged parts', () => {
  captureSourceLocations(true);
  try {
    const part = dsl.box({title: 'A'});
    const ref = sourceOf(part);
    assert.ok(ref);
    // The public rewrite is a transformer. Exercise located's no-overwrite rule directly.
    const [same] = located(dsl.rewrite)([part], () => undefined);
    assert.equal(same, part);
    assert.equal(sourceOf(part), ref);

    const outer = dsl.group(part);
    assert.ok(sourceOf(outer));
    assert.notEqual(sourceOf(outer), ref);
    assert.equal(sourceOf(outer.children[0]!), ref);
  } finally {
    captureSourceLocations(false);
  }
});

test('located: a tagged child keeps its untagged descendants outside the outer capture', () => {
  const grandchild = dsl.box({title: 'Added later'});
  captureSourceLocations(true);
  try {
    const child = dsl.group(dsl.box({title: 'Original'}));
    const childSource = sourceOf(child);
    assert.ok(childSource);
    child.children.push(grandchild);

    const outer = dsl.group(child);
    assert.ok(sourceOf(outer));
    assert.notEqual(sourceOf(outer), childSource);
    assert.equal(sourceOf(child), childSource);
    assert.equal(sourceOf(grandchild), undefined);
  } finally {
    captureSourceLocations(false);
  }
});

test('located: functions and non-part values pass through, including in a mixed array', () => {
  captureSourceLocations(true);
  try {
    const styled = dsl.styled(dsl.box, {tone: 'muted'});
    const callable = Object.assign(styled, {type: 'box'});
    const plain = {type: 1};
    const part = {type: 'box'};
    const values = [callable, plain, null, part];
    assert.equal(located(() => callable)(), callable);
    assert.equal(located(() => values)(), values);
    assert.equal(sourceOf(callable), undefined);
    assert.equal(sourceOf(plain), undefined);
    assert.ok(sourceOf(part));
  } finally {
    captureSourceLocations(false);
  }
});

test('source locations: public builders capture the call line and column', async t => {
  const fixture = 'test/fixtures/source-locations-builders.ts';
  const stackLimit = Error.stackTraceLimit, prepareStackTrace = Error.prepareStackTrace;
  installStackCapture();
  captureSourceLocations(true);
  try {
    const {calls} = await import('./fixtures/source-locations-builders.ts');
    const lines = fs.readFileSync(fixture, 'utf8').split('\n');
    for (const [name, call] of Object.entries(calls)) await t.test(name, () => {
      const prefix = `() => dsl.${name}(`;
      const index = lines.findIndex(line => line.includes(prefix));
      assert.notEqual(index, -1, `fixture call for ${name}`);
      const member = name.slice(name.lastIndexOf('.') + 1);
      const column = lines[index]!.indexOf(`.${member}(`) + 2;
      const parts = [call()].flat();
      assert.ok(parts.length > 0);
      for (const part of parts) {
        const ref = sourceOf(part);
        assert.ok(ref, `${name} did not capture a source`);
        assert.deepEqual(locateError(withSource(new Error(), ref), fixture).loc, {file: fixture, line: index + 1, column});
      }
    });
  } finally {
    captureSourceLocations(false);
    Error.stackTraceLimit = stackLimit;
    Error.prepareStackTrace = prepareStackTrace;
  }
});

test('source locations: every public DSL function is in the builder table or has an exclusion', async () => {
  const {calls} = await import('./fixtures/source-locations-builders.ts');
  const listed = new Set([...Object.keys(calls), ...Object.keys(nonBuilders)]);
  const exported = Object.entries(dsl).flatMap(([name, value]) => {
    if (typeof value !== 'function') return [name];
    const methods = Reflect.ownKeys(value).filter(key => typeof Object.getOwnPropertyDescriptor(value, key)?.value === 'function');
    return [name, ...methods.map(key => `${name}.${String(key)}`)];
  });
  assert.deepEqual([...listed].sort(), exported.sort());
});

test('source locations: every DSL module value is publicly exported or has an exclusion', async () => {
  const entry = new URL('../lib/dsl-pure.ts', import.meta.url);
  const source = fs.readFileSync(entry, 'utf8');
  // Read the module paths from the entry so a new builder module is checked automatically.
  const valueDeclarations = /^(?:import (?:\* as \w+|\{[^}]*\})|export \{[^}]*\}) from ['"](\.\/[^'"]+\.ts)['"]/gm;
  const modules = new Set(Array.from(source.matchAll(valueDeclarations), m => m[1]!));
  const missing = [];
  for (const path of modules) {
    const values = await import(new URL(path, entry).href);
    for (const name of Object.keys(values)) {
      if (!Object.hasOwn(dsl, name)) missing.push(`${path}:${name}`);
    }
  }
  const excluded = Object.entries(internalExports).flatMap(([path, values]) => Object.keys(values).map(name => `${path}:${name}`));
  assert.deepEqual(missing.sort(), excluded.sort(), 're-export each value through the DSL or document why it is internal');
});

test('source locations: steps, swimlane and versus give generated descendants the outer call source', async () => {
  captureSourceLocations(true);
  try {
    const {calls} = await import('./fixtures/source-locations-builders.ts');
    const stepRow = calls.steps();
    const [lane] = calls.swimlane();
    const [sides] = calls.versus();
    assert.equal(lane?.type, 'swimlane');
    assert.equal(sides?.type, 'grouprow');
    const refs = [sourceOf(stepRow), sourceOf(lane), sourceOf(sides)];
    for (const ref of refs) assert.ok(ref);
    for (const child of stepRow.children) assert.equal(sourceOf(child), refs[0]);
    for (const child of lane.steps) assert.equal(sourceOf(child), refs[1]);
    for (const child of sides.children) {
      assert.equal(child.type, 'group');
      assert.equal(sourceOf(child), refs[2]);
      for (const grandchild of child.children) assert.equal(sourceOf(grandchild), refs[2]);
    }
  } finally {
    captureSourceLocations(false);
  }
});
