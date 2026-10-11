import test from 'node:test';
import assert from 'node:assert/strict';
import {box, checkDiagram, closeMeasurer, connect, diagram, group, renderDiagram, row, spacer, versus} from '../lib/dsl.ts';

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
    connect('usual:bottom', 'evidence:top@0.25', {label: '見立てを照合'}),
    connect('actual:bottom', 'evidence:top@0.75', {label: '原因を裏づけ'}),
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
