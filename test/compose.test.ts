// ADR 0050: styled() fixes constructor options, rewrite() / diagram({transform}) restyle bands by a condition.
import test from 'node:test';
import assert from 'node:assert/strict';
import {box, bracket, caption, connect, diagram, em, group, legend, row, rewrite, spacer, styled, isType, within, when, swimlane, tree} from '../lib/dsl.ts';
import type {Band} from '../lib/types/index.ts';

test('styled: defaults fill in, the call wins, undefined does not erase a default', () => {
  const card = styled(box, {tone: 'muted', dashed: true});
  assert.equal(card({title: 'a'}).tone, 'muted');
  assert.equal(card({title: 'a', tone: 'accent'}).tone, 'accent');
  assert.equal(card({title: 'a', tone: undefined}).tone, 'muted');
  assert.equal(card({title: 'a'}).dashed, true);
});
test('styled: stacks like {...a, ...b}; the real constructor still checks and keeps the handle', () => {
  const base = styled(box, {tone: 'muted'}); // bound to a const first: nested inline, TypeScript instantiates box's Id and the handle type is lost
  const a = styled(base, {tone: 'danger', dashed: true});
  const b = styled(box, {tone: 'danger', dashed: true});
  assert.deepEqual(a({title: 'x'}), b({title: 'x'}));
  assert.equal(a({id: 'k', title: 'x'}).right, 'k:right');
  assert.throws(() => styled(box, {tone: 'solid', titleTone: 'accent'})({title: 'x'}), /white text/);
  assert.throws(() => styled(box, {id: 'same'} as never), /id cannot be a default/);
});
test('rewrite: patches by condition, reaches into children, same objects when nothing changes', () => {
  const inner = box({title: 'in'});
  const outer = box({title: 'out'});
  const g = group([inner]);
  const bands: Band[] = [g, outer];
  const out = rewrite(bands, when([isType('box'), within('group')], {tone: 'danger'}));
  assert.equal((out[0] as ReturnType<typeof group>).children[0]?.type === 'box' && ((out[0] as ReturnType<typeof group>).children[0] as ReturnType<typeof box>).tone, 'danger');
  assert.equal(out[1], outer);
  assert.equal(inner.tone, undefined, 'the input is not changed');
  assert.equal(rewrite(bands, () => undefined), bands);
});
test('rewrite: a patched band keeps its handle, children of a patched band are visited too', () => {
  const b = box({id: 'k', title: 'x'});
  const [p] = rewrite([b], when(isType('box'), {tone: 'accent'}));
  assert.equal((p as typeof b).right, 'k:right');
  const seen: string[] = [];
  rewrite([group([box({title: 'a'})])], (band) => { seen.push(band.type); return band.type === 'group' ? {tone: 'accent'} : undefined; });
  assert.deepEqual(seen, ['group', 'box']);
});
test('rewrite: only the look may change, and the values are checked like the constructor does', () => {
  const b = box({title: 'x'});
  assert.throws(() => rewrite([b], () => ({title: 'y'} as never)), /cannot change 'title'/);
  assert.throws(() => rewrite([b], () => ({tone: 'nope'})), /tone/);
  assert.throws(() => rewrite([group([b])], when(isType('group'), {tone: 'solid'})), /tone 'solid'/);
  assert.throws(() => rewrite([box({title: 'x', titleTone: 'accent'})], () => ({tone: 'solid'})), /white text/);
  assert.throws(() => rewrite([connect('a', 'b', {})], () => ({tone: 'accent'})), /cannot change 'tone'/);
  assert.throws(() => rewrite([connect('a', 'b', {})], () => ({line: 'double', weight: 'strong'})), /double/);
});
test('rewrite: reaches the band nodes of a tree, with the tree in the path', () => {
  const t = tree({label: 'root', children: [{label: 'c', band: box({title: 'n'}), w: 120}]}, {dir: 'down'});
  const paths: string[] = [];
  const out = rewrite([t], (band, path) => { if (band.type === 'box') { paths.push(path.map(p => p.type).join('>')); return {tone: 'accent'}; } return undefined; });
  assert.deepEqual(paths, ['tree']);
  assert.notEqual(out[0], t);
});
test('diagram({transform}): runs on what add() receives, after connectDefaults, and wins', () => {
  const d = diagram({theme: 'teal', connectDefaults: {line: 'dashed'}, transform: when(isType('connect'), {line: 'dotted'})}).add(box({id: 'a', title: 'a'}), box({id: 'b', title: 'b'}), connect('a', 'b', {}));
  assert.equal((d.bands[2] as {line: string}).line, 'dotted');
  const e = diagram({theme: 'teal', transform: [when(isType('box'), {tone: 'accent'}), when(isType('box'), {dashed: true})]}).add(row([box({title: 'a'})]), caption('c'));
  const kid = (e.bands[0] as ReturnType<typeof row>).children[0] as ReturnType<typeof box>;
  assert.equal(kid.tone, 'accent');
  assert.equal(kid.dashed, true);
});

test('rewrite: reveal / until only on the bands that take them, and as whole numbers', () => {
  assert.throws(() => rewrite([spacer(10)], () => ({reveal: 1})), /cannot change 'reveal'/);
  assert.throws(() => rewrite([legend([{tone: 'accent', label: 'x'}])], () => ({until: 2})), /cannot change 'until'/);
  assert.throws(() => rewrite([box({title: 'x'})], () => ({reveal: 'x' as never})), /whole number/);
  assert.equal((rewrite([box({title: 'x'})], () => ({reveal: 2}))[0] as ReturnType<typeof box>).reveal, 2);
});
test('rewrite: group rules follow the constructor (frameless takes no tone, plain is dashed)', () => {
  assert.throws(() => rewrite([group([box({title: 'x'})], {frame: false})], () => ({tone: 'accent'})), /no frame/);
  const g = rewrite([group([box({title: 'x'})])], when(isType('group'), {tone: 'plain'}))[0] as ReturnType<typeof group>;
  assert.equal(g.dashed, true);
});
test('rewrite: bracket / callout keep their arrow, a caption with em.* keeps its weight', () => {
  assert.throws(() => rewrite([bracket('a', 'b')], () => ({arrow: 'end'})), /fixed line and arrow/);
  assert.throws(() => rewrite([caption(['a ', em.b('b')])], () => ({bold: true})), /em\.\*/);
});
test('rewrite: reaches swimlane steps', () => {
  const sw = swimlane([{id: 'l', label: 'L'}], [{id: 's', lane: 'l', title: 'step'}]);
  const out = rewrite(sw, when(isType('box'), {tone: 'accent'}));
  const steps = (out[0] as {steps: {tone?: string}[]}).steps;
  assert.equal(steps[0]?.tone, 'accent');
});
test('rewrite: a band placed in two spots stays one band; a rule sees the patched ancestor', () => {
  const shared = box({title: 'x'});
  const out = rewrite([group([shared]), group([shared])], when(isType('box'), {tone: 'accent'})) as ReturnType<typeof group>[];
  assert.equal(out[0]?.children[0], out[1]?.children[0]);
  let seenTone = '';
  rewrite([group([box({title: 'y'})])], (b, path) => { if (b.type === 'group') return {tone: 'accent'}; seenTone = (path[0] as ReturnType<typeof group>).tone; return undefined; });
  assert.equal(seenTone, 'accent');
});
test('styled: a constructor whose first argument is not the options is refused', () => {
  const g = styled(group as unknown as (o: object, ...rest: unknown[]) => unknown, {});
  assert.throws(() => g([box({title: 'x'})]), /options object/);
  assert.throws(() => g(box({title: 'x'})), /options object/);
});
test('diagram({transform}): d.connect() goes through it too', () => {
  const d = diagram({theme: 'teal', transform: when(isType('connect'), {line: 'dotted'})}).add(box({id: 'a', title: 'a'}), box({id: 'b', title: 'b'})).connect('a', 'b');
  assert.equal((d.bands[2] as {line: string}).line, 'dotted');
});
