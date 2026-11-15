// ADR 0056 D6, D9: the rules of following the presenter (lib/present/sync.ts) and who may ask the local server what (lib/present/guard.ts).
import test from 'node:test';
import assert from 'node:assert/strict';
import {allowGo, applyGo, followIndex, GO_PER_SECOND, parseGo, reconnectDelay, takes, type SyncState} from '../lib/present/sync.ts';
import {allowedHosts, cookieValue, hostOk, postOk, sameSecret, streamOk} from '../lib/present/guard.ts';

const s0: SyncState = {epoch: 'e1', seq: 0, index: 0, version: 1};

test('a go is a whole step or a slide number; anything else is dropped', () => {
  assert.deepEqual(parseGo('{"type":"go","delta":1}'), {type: 'go', delta: 1});
  assert.deepEqual(parseGo({type: 'go', index: 3}), {type: 'go', index: 3});
  for (const bad of ['', 'x', '{"type":"go"}', '{"type":"go","delta":1.5}', '{"type":"go","index":-1}', '{"type":"go","delta":1,"index":2}',
    '{"type":"state","index":2}', '{"type":"go","index":"2"}', `{"type":"go","delta":1,"pad":"${'x'.repeat(300)}"}`, '{"type":"go","delta":100000}', null, 7]) {
    assert.equal(parseGo(bad), null, String(bad));
  }
});

test('steps add up in the order they arrive, kept within the deck; a go that does not move sends nothing', () => {
  const a = applyGo(s0, {type: 'go', delta: 1}, 5);
  const b = a && applyGo(a, {type: 'go', delta: 1}, 5);
  assert.deepEqual(b, {...s0, seq: 2, index: 2}, 'two quick presses move two slides');
  assert.equal(applyGo(s0, {type: 'go', delta: -1}, 5), null, 'before the first slide');
  assert.deepEqual(applyGo(s0, {type: 'go', index: 9999}, 5), {...s0, seq: 1, index: 4}, 'End goes to the last');
  assert.equal(applyGo(s0, {type: 'go', delta: 1}, 0), null, 'an empty deck');
});

test('a client takes a new epoch whatever its seq, and within one epoch only a later move', () => {
  assert.equal(takes(null, {epoch: 'e1', seq: 0}), true);
  assert.equal(takes({epoch: 'e1', seq: 5}, {epoch: 'e1', seq: 4}), false, 'an old message never moves it back');
  assert.equal(takes({epoch: 'e1', seq: 5}, {epoch: 'e1', seq: 5}), false);
  assert.equal(takes({epoch: 'e1', seq: 5}, {epoch: 'e1', seq: 6}), true);
  assert.equal(takes({epoch: 'e1', seq: 5}, {epoch: 'e2', seq: 0}), true, 'a server started again');
});

test('when the deck changes, the current slide follows its content, then its heading, then its number', () => {
  const before = [{hash: 'a', title: 'A'}, {hash: 'b', title: 'B'}, {hash: 'c', title: 'C'}];
  assert.equal(followIndex(before, [{hash: 'x', title: 'X'}, ...before], 1), 2, 'a slide added before it');
  assert.equal(followIndex(before, [{hash: 'a', title: 'A'}, {hash: 'b2', title: 'B'}, {hash: 'c', title: 'C'}], 1), 1, 'its content changed, its heading did not');
  assert.equal(followIndex(before, [{hash: 'c', title: 'C'}, {hash: 'b2', title: 'B'}], 1), 1, 'moved and edited: found by its heading');
  assert.equal(followIndex(before, [{hash: 'a', title: 'A'}, {hash: 'c', title: 'C'}], 1), 1, 'removed: the same number');
  assert.equal(followIndex(before, [{hash: 'a', title: 'A'}], 2), 0, 'removed past the end: the last slide');
  assert.equal(followIndex(before, [], 2), 0);
});

test('a presenter may go at most GO_PER_SECOND times a second', () => {
  const times: number[] = [];
  const sent = Array.from({length: GO_PER_SECOND + 5}, (_, i) => allowGo(times, 1000 + i)).filter(Boolean).length;
  assert.equal(sent, GO_PER_SECOND);
  assert.equal(allowGo(times, 2100), true, 'a second later');
});

test('reconnecting waits 0.5 s first, doubles up to 30 s, and is moved by ±50 %', () => {
  assert.equal(reconnectDelay(0, 0.5), 500);
  assert.equal(reconnectDelay(1, 0.5), 1000);
  assert.equal(reconnectDelay(20, 0.5), 30_000);
  assert.equal(reconnectDelay(0, 0), 250);
  assert.equal(reconnectDelay(20, 0.999999), 45_000);
});

test('the local server answers only to its own names, and changes state only for its own pages', () => {
  const hosts = allowedHosts(['localhost', '127.0.0.1', '::1', '192.168.1.5'], 3030);
  assert.ok(hostOk('localhost:3030', hosts) && hostOk('[::1]:3030', hosts) && hostOk('192.168.1.5:3030', hosts) && hostOk('LOCALHOST:3030', hosts));
  assert.ok(!hostOk('evil.example:3030', hosts) && !hostOk('localhost:3031', hosts) && !hostOk(undefined, hosts), 'a renamed DNS name, another port');
  assert.ok(postOk({host: 'localhost:3030', origin: 'http://localhost:3030'}));
  assert.ok(!postOk({host: 'localhost:3030', origin: 'http://localhost:9999'}), 'another port of the same machine');
  assert.ok(!postOk({host: 'localhost:3030'}), 'no Origin');
  // EventSource sends no Origin on the same origin; Sec-Fetch-Site says where it comes from
  assert.ok(streamOk({host: 'localhost:3030', secFetchSite: 'same-origin'}));
  assert.ok(streamOk({host: 'localhost:3030', origin: 'http://localhost:3030', secFetchSite: 'same-origin'}));
  assert.ok(!streamOk({host: 'localhost:3030', secFetchSite: 'same-site'}), 'another port is same-site');
  assert.ok(!streamOk({host: 'localhost:3030', origin: 'http://localhost:9999'}));
});

test('cookies and secrets', () => {
  assert.equal(cookieValue('a=1; sd-presenter-3030=xyz; b=2', 'sd-presenter-3030'), 'xyz');
  assert.equal(cookieValue('sd-presenter-30300=xyz', 'sd-presenter-3030'), undefined);
  assert.equal(cookieValue(undefined, 'x'), undefined);
  assert.ok(sameSecret('abc', 'abc') && !sameSecret('abc', 'abd') && !sameSecret('abc', 'ab'));
});
