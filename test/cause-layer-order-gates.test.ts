// ADR 0075 U1: where the row search runs and which forced layouts may enter the order pool.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {registerHooks} from 'node:module';
import test from 'node:test';
import {causeTree} from '../lib/dsl-pure.ts';
import {layeredAttempt} from '../lib/layered-route.ts';
import type {Attempt} from '../lib/layered-route.ts';
import {must} from '../lib/must.ts';
import {crossingsOf, parallelRuns} from '../lib/polyline-metrics.ts';
import {ROLES} from '../lib/tokens.ts';
import {layoutCauseBand, searchStats} from '../lib/toc.ts';
import type {WrapEnv} from '../lib/types/core.ts';
import {randomCrts} from './helpers/random-crt.ts';

const figures = randomCrts(3);
const bandOf = (g: number) => {
  const f = must(figures[g]);
  return causeTree(f.nodes, f.links, {tree: 'crt', dir: f.dir});
};
const args = [0, 0, 1800, (s: string, size: number) => s.length * size * 0.6, {...ROLES, note: 12}, {wrap: 'phrase', keepWords: false} satisfies WrapEnv] as const;

// Both bands have crossings. Pin their route points to those drawn on main before ADR 0075 U1.
for (const [name, g, extra, hash] of [
  ['whyWhyTree', 2, {layerFrom: 'effect'}, 'ec9e8aca39f13189'],
  ['band.base', 1, {base: 'down'}, '7c1fd8b307afabac'],
] as const) {
  test(`${name} bands skip the row search and keep main's route points`, () => {
    const before = searchStats.rowSearches;
    const layout = layoutCauseBand({...bandOf(g), ...extra}, ...args);
    const points = layout.edges.map(e => e.points);
    assert.ok(crossingsOf(points) > 0, 'the band has crossings');
    assert.equal(createHash('sha256').update(JSON.stringify(points)).digest('hex').slice(0, 16), hash);
    assert.equal(searchStats.rowSearches - before, 0);
  });
}

type ForcedRows = NonNullable<Parameters<typeof layeredAttempt>[2]['forceRows']>;
let forcedAttempt: ((attempt: Attempt, force: ForcedRows) => void) | undefined;

export const layeredAttemptForTest: typeof layeredAttempt = (nodes, edges, opts, routeOpts) => {
  const attempt = layeredAttempt(nodes, edges, opts, routeOpts);
  // Change only the forced attempt made for tryRows. The ordinary layouts and the final detour use the real router.
  if (opts.forceRows && !routeOpts.detour) {
    assert.equal(opts.forceRows.took, true, 'the original forced layout accepts the rows');
    assert.equal(attempt.fits, true);
    forcedAttempt?.(attempt, opts.forceRows);
  }
  return attempt;
};

async function loadTocWithAttemptHook(): Promise<typeof import('../lib/toc.ts')> {
  const toc = new URL('../lib/toc.ts?test=row-gates', import.meta.url);
  const route = new URL('../lib/layered-route.ts', import.meta.url);
  const stub = `export * from ${JSON.stringify(route.href)};
export {layeredAttemptForTest as layeredAttempt} from ${JSON.stringify(import.meta.url)};`;
  const stubUrl = `data:text/javascript,${encodeURIComponent(stub)}`;
  const hook = registerHooks({
    resolve(specifier, context, nextResolve) {
      if (context.parentURL === toc.href && specifier === './layered-route.ts') return nextResolve(stubUrl, context);
      return nextResolve(specifier, context);
    },
  });
  try {
    return await import(toc.href);
  } finally {
    hook.deregister();
  }
}

test('tryRows only admits a forced layout that meets the pool guards', async t => {
  const toc = await loadTocWithAttemptHook();
  const band = bandOf(0); // Plain #0 has a winning real row candidate and no ANDs.
  const wins = (alter?: typeof forcedAttempt): number => {
    let trials = 0;
    forcedAttempt = (attempt, force) => {
      trials++;
      alter?.(attempt, force);
    };
    const before = toc.searchStats.rowsWon;
    try {
      toc.layoutCauseBand(band, ...args);
    } finally {
      forcedAttempt = undefined;
    }
    assert.ok(trials > 0, 'a forced layout reached tryRows');
    return toc.searchStats.rowsWon - before;
  };

  await t.test('control: a valid row candidate wins the pool', () => {
    assert.equal(wins(), 1);
  });
  await t.test('frame: a candidate with a node in a different layer cannot win the pool', () => {
    assert.equal(wins(({lay}) => {
      const nodes = [...lay.nodes.values()];
      // Plain #0 runs left, so changing x moves the node across layers without changing the layout's height or routes.
      const first = must(nodes.toSorted((a, b) => a.x - b.x)[0]);
      first.x = Math.max(...nodes.map(n => n.x)) + 2;
    }), 0);
  });
  await t.test('overlap: a candidate that adds a sub-4px overlap cannot win the pool', () => {
    assert.equal(wins(({lay, routes}) => {
      const run = must(routes.get(lay.edges.findIndex(e => e.from === 'n5' && e.to === 'n7')));
      const i = lay.edges.findIndex(e => e.from === 'n5' && e.to === 'n11');
      assert.equal(parallelRuns([...routes.values()], 4).length, 0, 'the unmodified candidate has no overlap');
      const y = must(run[0]).y + 2;
      routes.set(i, must(routes.get(i)).map(p => ({...p, y})));
      const points = [...routes.values()];
      assert.equal(crossingsOf(points), 0, 'the candidate still removes the crossing');
      assert.ok(parallelRuns(points, 4).length > 0, 'the candidate now has a sub-4px overlap');
    }), 0);
  });
  await t.test('refusal: a layout whose rows were refused cannot win the pool', () => {
    assert.equal(wins((_attempt, force) => { force.took = false; }), 0);
  });
});
