import test from 'node:test';
import assert from 'node:assert/strict';
import {box, checkDiagram, chevron, closeMeasurer, connect, diagram, gantt, bars, quadrant, swimlane, tree} from '../lib/dsl.ts';
import {addScoped, bareNameIn, emptyScopes, qualify, resolveAnchor, scopesOf} from '../lib/anchor-scope.ts';
import {emitSvg} from '../lib/emit.ts';
import {collectRects} from '../lib/verify-handlers.ts';

test.after(() => closeMeasurer());

// ADR 0012 D1. No absolute geometry here (fonts differ between machines): which box a connector lands on is read off the rects.
const plan = (opts: {scope?: string} = {}) => chevron([{id: 'p0', label: '準備'}, {id: 'p1', label: '実施'}], opts);
const sched = (opts: {scope?: string} = {}) => gantt([{id: 'p0', label: '準備', start: '2026-10-05', end: '2026-10-16'}], opts);
const rectOf = (laidOut: {laidOut: {type: string}[]}, type: string, id: string) => {
  const b = laidOut.laidOut.find(x => x.type === type) as unknown as {anchors: {id: string; x: number; y: number; w: number; h: number}[]};
  return b.anchors.find(a => a.id === id)!;
};

test('resolveAnchor: registered, one scoped, several, none', () => {
  const t = emptyScopes();
  addScoped(t, 'plan', 'p0'); addScoped(t, 'plan', 'p1'); addScoped(t, 'sched', 'p0');
  const has = (names: string[]) => (n: string) => names.includes(n);
  assert.equal(resolveAnchor(t, 'plan.p0', has(['plan.p0', 'sched.p0'])), 'plan.p0'); // a qualified name is always exact
  assert.equal(resolveAnchor(t, 'p1', has(['plan.p1'])), 'plan.p1'); // exactly one scoped item answers to it
  assert.throws(() => resolveAnchor(t, 'p0', has(['plan.p0', 'sched.p0'])), /ambiguous anchor id "p0": plan\.p0, sched\.p0 — write one of them/);
  assert.throws(() => resolveAnchor(t, 'p0', has(['p0', 'sched.p0'])), /ambiguous anchor id "p0": p0, plan\.p0, sched\.p0/); // a registered bare id counts as one of them
  assert.equal(resolveAnchor(t, 'nope', has([])), undefined);
  assert.equal(resolveAnchor(emptyScopes(), 'a', has(['a'])), 'a'); // nothing scoped: the registered name, as before
  assert.equal(resolveAnchor(emptyScopes(), 'b', has(['a'])), undefined);
});

test('qualify / bareNameIn', () => {
  assert.equal(qualify('plan', 'p0'), 'plan.p0');
  assert.equal(qualify(undefined, 'p0'), 'p0');
  assert.equal(bareNameIn('plan', 'plan.p0'), 'p0');
  assert.equal(bareNameIn('plan', 'sched.p0'), undefined);
  assert.equal(bareNameIn(undefined, 'p0'), 'p0');
});

test('scopesOf reads every scoped item, in nested bands too', () => {
  const t = scopesOf([plan({scope: 'plan'}), sched({scope: 'sched'}), bars([{label: 'a', value: 1, id: 'p0'}], {scope: 'b'}), tree({label: 'r', id: 'p0'})]);
  assert.deepEqual(t.byBare.get('p0'), ['plan.p0', 'sched.p0', 'b.p0']);
  assert.deepEqual(t.byBare.get('p1'), ['plan.p1']);
  assert.equal(scopesOf([plan(), sched()]).byBare.size, 0); // unscoped bands add nothing
});

test('a scope must be a plain name', () => {
  for (const bad of ['', 'a b', 'a.b', 'a:b', 'a@b', 'a#b']) assert.throws(() => plan({scope: bad}), /scope must be a non-empty name/);
});

test('the same id in two scoped bands is fine; a qualified name lands on the right one', async () => {
  const d = diagram({theme: 'blue'}).add(plan({scope: 'plan'}), sched({scope: 'sched'}), connect('plan.p0:bottom', 'sched.p0:top'));
  const {laidOut} = await checkDiagram(d);
  const c = laidOut.connects[0];
  assert.equal(c.fromId, 'plan.p0');
  assert.equal(c.toId, 'sched.p0');
  const from = rectOf(laidOut, 'chevron', 'p0'), to = rectOf(laidOut, 'gantt', 'p0');
  assert.equal(c.from.y, from.y + from.h); // bottom of the chevron step
  assert.equal(c.to.y, to.y); // top of the gantt bar
  // the band's own output keeps the bare ids
  assert.ok((laidOut.laidOut.find(x => x.type === 'chevron') as unknown as {anchors: {id: string}[]}).anchors.every(a => !a.id.includes('.')));
});

test('a bare id that only one scoped item has still passes', async () => {
  const d = diagram({theme: 'blue'}).add(plan({scope: 'plan'}), sched({scope: 'sched'}), connect('p1:bottom', 'sched.p0:top'));
  const {laidOut} = await checkDiagram(d);
  assert.equal(laidOut.connects[0].fromId, 'plan.p1');
});

test('a bare id several scoped items have is an error that names them (whatever the order)', async () => {
  await assert.rejects(checkDiagram(diagram({theme: 'blue'}).add(plan({scope: 'plan'}), sched({scope: 'sched'}), connect('p0', 'p1'))), /ambiguous anchor id "p0": plan\.p0, sched\.p0 — write one of them/);
  // a connect() that comes before the second band is just as ambiguous
  await assert.rejects(checkDiagram(diagram({theme: 'blue'}).add(plan({scope: 'plan'}), connect('p0', 'p1'), sched({scope: 'sched'}))), /ambiguous anchor id "p0"/);
});

test('a registered bare id and a scoped item with the same name are ambiguous too', async () => {
  await assert.rejects(checkDiagram(diagram({theme: 'blue'}).add(box({id: 'p0', title: 'x'}), plan({scope: 'plan'}), connect('p0', 'plan.p1'))), /ambiguous anchor id "p0": p0, plan\.p0/);
  // the qualified name is exact, and a bare id nobody else answers to is itself
  const {laidOut} = await checkDiagram(diagram({theme: 'blue'}).add(box({id: 'p9', title: 'x'}), plan({scope: 'plan'}), connect('plan.p0', 'p9')));
  assert.equal(laidOut.connects[0].fromId, 'plan.p0');
  assert.equal(laidOut.connects[0].toId, 'p9');
});

test('inside one scope a duplicate is still a duplicate; across scopes it is not', async () => {
  const dup = chevron([{id: 'p0', label: 'a'}, {id: 'p1', label: 'b'}], {scope: 's'});
  const dup2 = chevron([{id: 'p0', label: 'a'}], {scope: 's'});
  await assert.rejects(checkDiagram(diagram({theme: 'blue'}).add(dup, dup2)), /duplicate anchor id "s\.p0"/);
  await checkDiagram(diagram({theme: 'blue'}).add(dup, chevron([{id: 'p0', label: 'a'}], {scope: 't'})));
  // without a scope the old error stays as it was
  await assert.rejects(checkDiagram(diagram({theme: 'blue'}).add(plan(), sched())), /duplicate anchor id "p0": a gantt task takes an id that another anchor already has/);
});

test('a scoped name that is not there says which scope has that item', async () => {
  await assert.rejects(checkDiagram(diagram({theme: 'blue'}).add(plan({scope: 'plan'}), box({id: 'x', title: 'x'}), connect('x', 'sched.p0'))), /unknown anchor id "sched\.p0".*did you mean "plan\.p0"\?/);
});

test('a handle of a scoped band names the item qualified', () => {
  const g = gantt([{id: 'p0', label: 'a', start: '2026-10-05', end: '2026-10-16'}], {scope: 'sched'});
  assert.equal(g.anchors.p0.right, 'sched.p0:right');
  assert.equal(g.anchors.p0.at('top', 0.25), 'sched.p0:top@0.25');
  assert.equal(g.anchors.p0.id, 'sched.p0');
  const plain = gantt([{id: 'p0', label: 'a', start: '2026-10-05', end: '2026-10-16'}]);
  assert.equal(plain.anchors.p0.right, 'p0:right'); // no scope: as before
});

test('bars, quadrant and swimlane items are scoped too', async () => {
  const d = diagram({theme: 'blue'}).add(
    bars([{label: 'a', value: 1, id: 'k'}, {label: 'b', value: 2}], {scope: 'b1'}),
    bars([{label: 'a', value: 1, id: 'k'}], {scope: 'b2'}),
    quadrant({x: {title: 'X', low: '低', high: '高'}, y: {title: 'Y', low: '低', high: '高'}, items: [{id: 'k', label: 'q', at: [0.2, 0.8]}], scope: 'qd'}),
    swimlane([{id: 'l', label: 'L'}], [{id: 'k', lane: 'l', title: 'S'}], {scope: 'sw'}),
    connect('b1.k', 'b2.k'), connect('qd.k', 'sw.k'),
  );
  const {laidOut} = await checkDiagram(d);
  assert.deepEqual(laidOut.connects.map(c => [c.fromId, c.toId]), [['b1.k', 'b2.k'], ['qd.k', 'sw.k']]);
});

test('without scope the figure is what it was: same connects, same svg whatever the table', async () => {
  const mk = () => diagram({theme: 'blue'}).add(box({id: 'a', title: 'A'}), box({id: 'b', title: 'B'}), connect('a:right', 'b:left'));
  const {laidOut} = await checkDiagram(mk());
  assert.deepEqual([laidOut.connects[0].fromId, laidOut.connects[0].toId], ['a', 'b']);
  assert.equal(emitSvg(laidOut, {}), emitSvg((await checkDiagram(mk())).laidOut, {}));
});

test('verify knows a scoped band\'s rects by their qualified names (a connector may touch its own ends)', async () => {
  const {laidOut} = await checkDiagram(diagram({theme: 'blue'}).add(plan({scope: 'plan'}), sched({scope: 'sched'}), connect('plan.p0:bottom', 'sched.p0:top')));
  const ids = collectRects(laidOut).map(r => r.id);
  assert.ok(ids.includes('plan.p0') && ids.includes('plan.p1') && ids.includes('sched.p0'));
  assert.ok(!ids.includes('p0')); // the bare id is the band's own business, not a name of the figure
});
