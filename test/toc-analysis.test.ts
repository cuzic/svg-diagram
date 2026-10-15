import test from 'node:test';
import assert from 'node:assert/strict';
import {coreDrivers, reachCounts} from '../lib/toc-analysis.ts';

const N = (id: string, role?: string) => ({id, ...(role ? {role} : {})});

test('reachCounts(): counts the ude an entity reaches through other entities, not itself', () => {
  const nodes = [N('r1'), N('m'), N('u1', 'ude'), N('u2', 'ude'), N('r2'), N('u3', 'ude')];
  const links = [{from: 'r1', to: 'm'}, {from: 'm', to: 'u1'}, {from: 'm', to: 'u2'}, {from: 'r2', to: 'u3'}];
  const c = reachCounts(nodes, links);
  assert.deepEqual([...c], [['r1', 2], ['r2', 1]], 'only the starting entities (nothing enters them) are counted');
});

test('reachCounts(): every member of an AND reaches the effect', () => {
  const c = reachCounts([N('a'), N('b'), N('u', 'ude')], [{from: ['a', 'b'], to: 'u'}]);
  assert.equal(c.get('a'), 1);
  assert.equal(c.get('b'), 1);
});

test('reachCounts(): a back arrow and a blocks arrow are not walked, and they do not make an entity a non-start', () => {
  const nodes = [N('a'), N('b'), N('u1', 'ude'), N('u2', 'ude')];
  const c = reachCounts(nodes, [{from: 'a', to: 'b'}, {from: 'b', to: 'u1'}, {from: 'b', to: 'u2', kind: 'blocks'}, {from: 'u1', to: 'a', back: true}]);
  assert.equal(c.get('a'), 1, 'u2 is only blocked');
  assert.ok(c.has('a'), 'a is entered only by a back arrow, so it still starts the chain');
});

test('reachCounts(): a cycle is walked once', () => {
  const c = reachCounts([N('s'), N('a'), N('b'), N('u', 'ude')], [{from: 's', to: 'a'}, {from: 'a', to: 'b'}, {from: 'b', to: 'a'}, {from: 'b', to: 'u'}]);
  assert.equal(c.get('s'), 1);
});

test('coreDrivers(): the most reach, 2 or more; a tie keeps all', () => {
  assert.deepEqual(coreDrivers(new Map([['a', 3], ['b', 1]])), ['a']);
  assert.deepEqual(coreDrivers(new Map([['a', 2], ['b', 2], ['c', 1]])), ['a', 'b']);
  assert.deepEqual(coreDrivers(new Map([['a', 1], ['b', 1]])), [], 'one is not a driver');
  assert.deepEqual(coreDrivers(new Map()), []);
});
