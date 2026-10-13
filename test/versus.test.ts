import test from 'node:test';
import assert from 'node:assert/strict';
import {banner, box, caption, stat, checkDiagram, closeMeasurer, connect, diagram, group, renderDiagram, row, spacer, versus} from '../lib/dsl.ts';

test.after(() => closeMeasurer());

const left = () => ({
  id: 'usual', title: 'よくある見立て', tone: 'muted' as const,
  children: [box({id: 'surface', title: '利用者が慣れていない'})],
});
const right = () => ({
  id: 'actual', title: '実際の原因', tone: 'accent' as const,
  children: [box({id: 'cause', title: '判断材料が画面にない'})],
});
const shared = () => ({
  id: 'evidence', title: '共通して観察するもの', tone: 'plain' as const,
  children: [box({id: 'facts', title: '操作ログと聞き取り'})],
});

test('versus() expands to the same row, groups and connects as the manual form', async () => {
  const manual = diagram({theme: 'blue'}).add(
    row([group(left().children, left()), group(right().children, right())], {cols: [6, 6]}),
    spacer(48),
    group(shared().children, shared()),
    {...connect('usual:bottom', 'evidence:top@0.25', {label: '見立てを照合'}), plumb: true},
    {...connect('actual:bottom', 'evidence:top@0.75', {label: '原因を裏づけ'}), plumb: true},
  );
  const sugar = diagram({theme: 'blue'}).add(versus(left(), right(), {
    shared: shared(), connectLabels: {left: '見立てを照合', right: '原因を裏づけ'},
  }));
  const [manualResult, sugarResult] = await Promise.all([
    renderDiagram(manual, {name: 'versus.svg', budget: 'cacheOnly'}),
    renderDiagram(sugar, {name: 'versus.svg', budget: 'cacheOnly'}),
  ]);
  assert.equal(sugarResult.svg, manualResult.svg);
  assert.deepEqual(sugarResult.verdict.problems, []);
});

test('versus() without shared is only a 12-column row of two groups', async () => {
  const {laidOut, verdict} = await checkDiagram(diagram({theme: 'blue'}).add(versus(
    {title: '社内', children: box({id: 'inside', title: '地続き'})},
    {title: '顧客', children: box({id: 'outside', title: '接点をまたぐ'})},
  )));
  assert.deepEqual(verdict.problems, []);
  assert.equal(laidOut.laidOut.filter(x => x.type === 'group').length, 2);
  assert.equal(laidOut.connects.length, 0);
});

test('versus() requires all three group ids before it can connect shared', () => {
  assert.throws(() => (versus as (...args: unknown[]) => unknown)(
    {title: 'L', children: box({title: 'left'})},
    {id: 'right', title: 'R', children: box({title: 'right'})},
    {shared: {id: 'shared', children: box({title: 'common'})}},
  ), /left, right and shared need an id/);
});

export function versusTypeCases(): void {
  const comparison = versus(
    {id: 'left', children: box({id: 'left-child'})},
    {id: 'right', children: box({id: 'right-child'})},
    {shared: {id: 'shared', children: box({id: 'shared-child'})}},
  );
  diagram({theme: 'blue'}).add(comparison, connect('left-child', 'shared-child'));
  // @ts-expect-error versus() propagates child ids to add()
  diagram({theme: 'blue'}).add(comparison, connect('left-child', 'missing'));
  const withChildRef = versus(
    {children: [box({id: 'inside'}), connect('inside', 'outside')]},
    {children: box({title: 'R'})},
  );
  diagram({theme: 'blue'}).add(box({id: 'outside'}), withChildRef);
  // @ts-expect-error versus() propagates refs from children to add()
  diagram({theme: 'blue'}).add(withChildRef);
  // @ts-expect-error shared connections require a left id
  versus({children: box({title: 'L'})}, {id: 'r', children: box({title: 'R'})}, {shared: {id: 's', children: box({title: 'S'})}});
}

test('versus() ends on the same right edge as a banner above it (snapping the right edge, not the width)', async () => {
  const {svg} = await renderDiagram(diagram({theme: 'blue'}).add(banner({headline: '見出し'}), versus(left(), right())), {name: 'versus.svg', budget: 'cacheOnly'});
  const rects = [...svg.matchAll(/<rect x="([\d.]+)" y="[\d.]+" width="([\d.]+)" height="[\d.]+" rx="8"/g)].map(m => [Number(m[1]), Number(m[2])]);
  const edges = rects.map(([x, w]) => x + w);
  assert.equal(Math.max(...edges), rects[0][0] + rects[0][1], 'no frame reaches past the banner');
});

test('versus() shared connectors take route / arrow', () => {
  const mk = (extra: object) => versus(left(), right(), {shared: shared(), ...extra});
  const cons = (b: ReturnType<typeof mk>) => b.filter(x => x.type === 'connect') as {route: string; arrow: string}[];
  assert.deepEqual(cons(mk({})).map(c => [c.route, c.arrow]), [['straight', 'end'], ['straight', 'end']]);
  assert.deepEqual(cons(mk({connectRoute: 'elbow', connectArrow: 'none'})).map(c => [c.route, c.arrow]), [['elbow', 'none'], ['elbow', 'none']]);
  assert.deepEqual(cons(mk({connectRoute: 'straight', connectArrow: 'none'})).map(c => [c.route, c.arrow]), [['straight', 'none'], ['straight', 'none']]);
});

test('versus() shared connectors drop plumb (issue #95): vertical by default, and elbow has no jog', async () => {
  for (const extra of [{}, {connectRoute: 'elbow' as const}, {connectLabels: {left: '照合', right: '裏づけ'}}]) {
    const {laidOut, verdict} = await checkDiagram(diagram({theme: 'blue'}).add(versus(left(), right(), {shared: shared(), ...extra})));
    assert.deepEqual(verdict.problems, []);
    assert.equal(laidOut.connects.length, 2);
    for (const c of laidOut.connects) {
      const xs = c.points.map(p => p.x);
      assert.equal(new Set(xs).size, 1, `one x for every point (${JSON.stringify(c.points)})`);
      // a plain label sits beside the vertical line, not struck through by it
      if (c.labelBox) assert.ok(c.labelBox.x > xs[0], `label right of the line (${JSON.stringify(c.labelBox)} vs x=${xs[0]})`);
    }
  }
});

test('versus() children: arrays stack, direction row puts them side by side', async () => {
  const {laidOut, verdict} = await checkDiagram(diagram({theme: 'blue'}).add(versus(
    {id: 'l', title: 'L', children: [box({id: 'a', title: 'A'}), box({id: 'b', title: 'B'})]},
    {id: 'r', title: 'R', direction: 'row', children: [box({id: 'c', title: 'C'}), box({id: 'd', title: 'D'})]},
  )));
  assert.deepEqual(verdict.problems, []);
  const find = (n: unknown, id: string): {x: number; y: number; w: number; h: number} | undefined => {
    if (!n || typeof n !== 'object') return undefined;
    if ((n as {id?: string}).id === id && typeof (n as {x?: number}).x === 'number') return n as never;
    for (const v of Object.values(n)) { const hit = find(v, id); if (hit) return hit; }
    return undefined;
  };
  const at = (id: string) => find(laidOut.laidOut, id)!;
  assert.equal(at('a').x, at('b').x, 'stacked: same x');
  assert.ok(at('b').y > at('a').y + at('a').h - 1, 'stacked: b below a');
  assert.equal(at('c').y, at('d').y, 'row: same y');
  assert.ok(at('d').x >= at('c').x + at('c').w, 'row: d right of c');
  assert.throws(() => versus({children: box({title: 'x'}), direction: 'rows' as never}, {children: box({title: 'y'})}), /direction must be 'column' or 'row'/);
});

test('row() wraps caption / banner children in a frameless group, keeping their row placement', async () => {
  const {verdict} = await renderDiagram(diagram({theme: 'blue'}).add(row([caption('列見出し'), stat('42', '件')])), {name: 'r.svg', budget: 'cacheOnly'});
  assert.deepEqual(verdict.problems, []);
  const r = row([banner({headline: 'h', span: 4} as never), box({title: 'b', span: 8})], {cols: 12}) as {children: {type: string; span?: number; frame?: boolean}[]};
  assert.deepEqual(r.children.map(c => [c.type, c.span, c.frame]), [['group', 4, false], ['box', 8, undefined]]);
});
