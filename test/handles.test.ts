// Handles (lib/dsl.ts withHandle / withAnchors): runtime shape of `box({id}).right` etc. and the guarantee that
// they change nothing about what a band is or how it renders.
import test from 'node:test';
import assert from 'node:assert/strict';
import {diagram, box, banner, group, table, sequence, wireframe, screens, swimlane, row, connect, branch, wf, checkDiagram, closeMeasurer} from '../lib/dsl.ts';
import {emitSvg} from '../lib/emit.ts';
import type {Band, ConnectBand, LaidOutConnect} from '../lib/types.ts';

test.after(() => closeMeasurer());

const SIDES = ['left', 'right', 'top', 'bottom', 'center'] as const;
type Hd = {id?: string; at(s: string, t: number): string} & Record<(typeof SIDES)[number], string>;
const asHandle = (x: unknown) => x as Hd;

function checkHandle(h: Hd, id: string) {
  for (const s of SIDES) assert.equal(h[s], `${id}:${s}`);
  assert.equal(h.at('bottom', 0.25), `${id}:bottom@0.25`);
  assert.equal(h.at('left', 0), `${id}:left@0`);
  assert.equal(h.at('top', 1), `${id}:top@1`);
}

test('every id-carrying constructor returns a handle that produces id:side[@t] ref strings', () => {
  checkHandle(asHandle(box({id: 'b1', title: 'x'})), 'b1');
  checkHandle(asHandle(banner({id: 'ban', headline: 'H'})), 'ban');
  checkHandle(asHandle(group([box({id: 'inner'})], {id: 'zone'})), 'zone');
  checkHandle(asHandle(table([{label: 'c'}], [['v']], {id: 'tbl'})), 'tbl');
  checkHandle(asHandle(sequence([{id: 'u', label: 'U'}, {id: 'v', label: 'V'}], [{from: 'u', to: 'v', label: 'x'}], {id: 'seq'})), 'seq');
  checkHandle(asHandle(wireframe(wf.text('x'), {id: 'wire'})), 'wire');
});

test('a band without an id is not a handle', () => {
  for (const b of [box({title: 'x'}), banner({headline: 'H'}), group([]), table([{label: 'c'}], []), wireframe(wf.text('x'))]) {
    const h = b as unknown as Record<string, unknown>;
    assert.equal(h['right'], undefined);
    assert.equal(h['at'], undefined);
  }
});

test('screens() and swimlane() expose one handle per item / step id under .anchors; id-less ones are skipped', () => {
  const flow = screens([{id: 'a', root: wf.text('x')}, {id: 'b', root: wf.text('y'), at: [1, 0]}, {title: 'anon', root: wf.text('z'), at: [2, 0]}] as never);
  const anchors = (flow as unknown as {anchors: Record<string, Hd>}).anchors;
  assert.deepEqual(Object.keys(anchors).sort(), ['a', 'b']);
  checkHandle(anchors['a']!, 'a'); checkHandle(anchors['b']!, 'b');
  assert.equal(anchors['a']!.id, 'a');

  const lane = swimlane([{id: 'dev', label: 'D'}], [{id: 's1', lane: 'dev', title: 'T'}, {id: 's2', lane: 'dev', title: 'U'}, {lane: 'dev', title: 'no id'}]);
  const sa = (lane as unknown as {anchors: Record<string, Hd>}).anchors;
  assert.deepEqual(Object.keys(sa).sort(), ['s1', 's2']);
  checkHandle(sa['s2']!, 's2');
  // the array itself is still [swimlane block, ...flows] and anchors does not show up as an element or key
  assert.equal(Array.isArray(lane), true);
  assert.equal(lane.length, 1);
  assert.deepEqual(Object.keys(lane), ['0']);
});

test('handle properties are non-enumerable: keys, spread and JSON are exactly what they were without an id', () => {
  const withId = box({id: 'a', title: 'T', body: 'b'});
  assert.deepEqual(Object.keys(withId), ['type', 'id', 'title', 'body']);
  assert.deepEqual({...withId}, {type: 'box', id: 'a', title: 'T', body: 'b'});
  assert.equal(JSON.stringify(withId), '{"type":"box","id":"a","title":"T","body":"b"}');
  for (const k of [...SIDES, 'at']) {
    const desc = Object.getOwnPropertyDescriptor(withId, k)!;
    assert.equal(desc.enumerable, false, k);
    assert.equal(desc.writable, false, k);
  }
  const l = swimlane([{id: 'x', label: 'X'}], [{id: 's', lane: 'x', title: 'T'}]);
  assert.equal(Object.getOwnPropertyDescriptor(l, 'anchors')!.enumerable, false);
  assert.equal(JSON.stringify(l), JSON.stringify([...l]), 'JSON of the array does not mention anchors');
  const sc = screens([{id: 'a', root: wf.text('x')}]);
  assert.ok(!('anchors' in {...sc}));
  assert.ok(!JSON.stringify(sc).includes('anchors'));
});

test('connect(handle refs) builds the very same ConnectBand as the equivalent strings', () => {
  const list = box({id: 'list', title: 'L'}), detail = box({id: 'detail', title: 'D'});
  const viaHandle = connect(list.at('bottom', 0.25), detail.top, {route: 'elbow', label: 'x'});
  const viaString = connect('list:bottom@0.25', 'detail:top', {route: 'elbow', label: 'x'});
  assert.deepEqual(viaHandle, viaString);
  assert.equal(typeof viaHandle.from, 'string');
  const [br] = branch(list.right, [{to: detail.left, label: 'y'}]);
  assert.deepEqual([br!.from, br!.to], ['list:right', 'detail:left']);
});

const build = (useHandles: boolean) => {
  const a = box({id: 'a', title: 'A'}), b = box({id: 'b', title: 'B'}), c = box({id: 'c', title: 'C'});
  const flow = screens([{id: 'p', root: wf.text('x'), at: [0, 0]}, {id: 'q', root: wf.text('y'), at: [0, 1]}]);
  const d = diagram({theme: 'blue', title: 't'});
  d.add(row([a, b, c]), flow);
  d.add(
    useHandles ? connect(a.right, b.left) : connect('a:right', 'b:left'),
    useHandles ? connect(a.at('bottom', 0.25), c.at('bottom', 0.75), {route: 'loop-under'}) : connect('a:bottom@0.25', 'c:bottom@0.75', {route: 'loop-under'}),
    useHandles ? connect(flow.anchors.p.right, flow.anchors.q.left) : connect('p:right', 'q:left'),
  );
  return d;
};
const svgOf = async (d: ReturnType<typeof diagram>) => emitSvg((await checkDiagram(d)).laidOut);

test('a diagram wired with handles lays out and renders byte-identically to the string version', async () => {
  const [h, s] = [await checkDiagram(build(true)), await checkDiagram(build(false))];
  const pts = (cs: LaidOutConnect[]) => cs.map(c => [c.fromId, c.toId, c.points]);
  assert.deepEqual(pts(h.laidOut.connects), pts(s.laidOut.connects));
  assert.equal(h.laidOut.connects.length, 3);
  assert.equal(emitSvg(h.laidOut), emitSvg(s.laidOut));
});

test('stripping the handle properties (spreading every band) does not change the SVG either', async () => {
  const withHandles = build(true);
  const stripped = diagram({theme: 'blue', title: 't'});
  const strip = (b: Band): Band => {
    const o = {...b} as Record<string, unknown>;
    if (Array.isArray(o['children'])) o['children'] = o['children'].map(strip);
    return o as unknown as Band;
  };
  stripped.add(...withHandles.bands.map(strip));
  assert.equal(await svgOf(stripped), await svgOf(build(false)));
});

test('handle ref with at() resolves to the offset point on that side', async () => {
  const a = box({id: 'a', title: 'A'}), b = box({id: 'b', title: 'B'});
  const mk = async (t: number) => {
    const d = diagram({theme: 'blue'});
    d.add(row([a, b]), connect(a.at('bottom', t), b.bottom));
    return (await checkDiagram(d)).laidOut.connects[0]!.points[0];
  };
  const [p0, p1] = [await mk(0), await mk(1)];
  assert.ok(p1!.x > p0!.x, 'bottom@1 is to the right of bottom@0');
  assert.equal(p0!.y, p1!.y);
});

test('a connect() ref list built from handles keeps type "connect"', () => {
  const x = box({id: 'x'}), y = box({id: 'y'});
  const c: ConnectBand = connect(x.center, y.center);
  assert.equal(c.type, 'connect');
});
