// lib/resolve-hook.ts: `import 'svg-diagram'` and the fresh-load query that reaches every local file of a re-read source.
import test from 'node:test';
import assert from 'node:assert/strict';
import {resolve, FRESH_PARAM} from '../lib/resolve-hook.ts';

const DSL = new URL('../lib/dsl.ts', import.meta.url).href;
const OWN_FILE = new URL('../lib/layout.ts', import.meta.url).href;
const ctx = (parentURL?: string) => ({parentURL, conditions: [], importAttributes: {}}) as never;
const to = (url: string) => async () => ({url});
const fresh = (url: string, n = 7) => `${url}?${FRESH_PARAM}=${n}`;

test('"svg-diagram" is the DSL module, without asking the next resolver', async () => {
  const r = await resolve('svg-diagram', ctx('file:///p/a.ts'), async () => { throw new Error('should not be called'); });
  assert.equal(r.url, DSL);
  assert.equal(r.shortCircuit, true);
});

test('anything else is left to the next resolver when the importer is not a fresh load', async () => {
  for (const parent of [undefined, 'file:///p/a.ts', 'file:///p/a.ts?v=1']) {
    assert.equal((await resolve('./b.ts', ctx(parent), to('file:///p/b.ts'))).url, 'file:///p/b.ts');
  }
});

test('a local file imported by a fresh load carries the fresh query, and so does what that imports', async () => {
  const a = fresh('file:///p/a.ts');
  const b = await resolve('./b.ts', ctx(a), to('file:///p/b.ts'));
  assert.equal(b.url, fresh('file:///p/b.ts'));
  const c = await resolve('./c.ts', ctx(b.url), to('file:///p/c.ts'));
  assert.equal(c.url, fresh('file:///p/c.ts'));
});

test('the same fresh load gives the same URL to a file imported from two places (one module, not two)', async () => {
  const a = fresh('file:///p/a.ts', 3), b = fresh('file:///p/b.ts', 3);
  const viaA = await resolve('./shared.ts', ctx(a), to('file:///p/shared.ts'));
  const viaB = await resolve('./shared.ts', ctx(b), to('file:///p/shared.ts'));
  assert.equal(viaA.url, viaB.url);
});

test('a different fresh load gets different URLs', async () => {
  const one = await resolve('./b.ts', ctx(fresh('file:///p/a.ts', 1)), to('file:///p/b.ts'));
  const two = await resolve('./b.ts', ctx(fresh('file:///p/a.ts', 2)), to('file:///p/b.ts'));
  assert.notEqual(one.url, two.url);
});

test('node_modules, node: builtins and svg-diagram\'s own modules keep their URLs', async () => {
  const a = fresh('file:///p/a.ts');
  assert.equal((await resolve('left-pad', ctx(a), to('file:///p/node_modules/left-pad/index.js'))).url, 'file:///p/node_modules/left-pad/index.js');
  assert.equal((await resolve('node:fs', ctx(a), to('node:fs'))).url, 'node:fs');
  assert.equal((await resolve('../lib/layout.ts', ctx(a), to(OWN_FILE))).url, OWN_FILE);
});

test('a URL that already has a query keeps it, the fresh query is added with &; one that has the fresh query is not tagged twice', async () => {
  const a = fresh('file:///p/a.ts');
  assert.equal((await resolve('./b.ts?x=1', ctx(a), to('file:///p/b.ts?x=1'))).url, `file:///p/b.ts?x=1&${FRESH_PARAM}=7`);
  assert.equal((await resolve('./b.ts', ctx(a), to(fresh('file:///p/b.ts')))).url, fresh('file:///p/b.ts'));
});

test('format and import attributes from the next resolver are kept', async () => {
  const r = await resolve('./d.json', ctx(fresh('file:///p/a.ts')), async () => ({url: 'file:///p/d.json', format: 'json', importAttributes: {type: 'json'}}));
  assert.equal(r.format, 'json');
  assert.deepEqual(r.importAttributes, {type: 'json'});
});
