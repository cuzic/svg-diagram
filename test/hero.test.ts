import test from 'node:test';
import assert from 'node:assert/strict';
import {banner, box, caption, checkDiagram, closeMeasurer, connect, diagram, hero, renderDiagram, row, stat} from '../lib/dsl.ts';

test.after(() => closeMeasurer());

const steps = () => [box({id: 'a', title: '申請'}), box({id: 'b', title: '一次承認'}), box({id: 'c', title: '決裁'})];

test('hero() expands to the banner, stat row, flow, caption and note it names', async () => {
  const manual = diagram({theme: 'blue'}).add(
    banner({headline: '待ち時間が縮んだ', tone: 'accent'}),
    row([...steps(), stat('-67%', '待ち時間', {tone: 'accent', size: 'display', flex: 1.5})], {arrows: 'between'}),
    caption('一言', {bold: true, tone: 'text'}),
    caption('出典'),
  );
  const sugar = diagram({theme: 'blue'}).add(hero({
    banner: {headline: '待ち時間が縮んだ', tone: 'accent'}, stat: {value: '-67%', label: '待ち時間', tone: 'accent'}, flow: steps(), caption: '一言', note: '出典',
  }));
  const [m, s] = await Promise.all([manual, sugar].map(d => renderDiagram(d, {name: 'hero.svg', budget: 'cacheOnly'})));
  assert.equal(s.svg, m.svg);
  assert.deepEqual(s.verdict.problems, []);
});

test('hero() stacks the number above a long flow, and its ids are connect() targets', async () => {
  const flow = ['a', 'b', 'c', 'd', 'e'].map(id => box({id, title: id}));
  const d = diagram({theme: 'blue'}).add(hero({stat: {id: 'n', value: 12, label: '件'}, flow}), connect('n:bottom', 'c:top'));
  const {laidOut, verdict} = await checkDiagram(d);
  assert.deepEqual(verdict.problems, []);
  const n = laidOut.laidOut.flatMap(b => b.type === 'row' ? b.children : []).find(c => c.id === 'n')!;
  const a = laidOut.laidOut.flatMap(b => b.type === 'row' ? b.children : []).find(c => c.id === 'a')!;
  assert.ok(n.y < a.y, 'the number sits above the flow');
});

test('hero() rejects a missing stat, an empty flow, a non-box step and a bad layout', () => {
  assert.throws(() => (hero as (o: unknown) => unknown)({flow: steps()}), /needs a stat/);
  assert.throws(() => hero({stat: {value: 1, label: 'x'}, flow: []}), /at least one box/);
  assert.throws(() => hero({stat: {value: 1, label: 'x'}, flow: [caption('x') as never]}), /flow\[0\] is a caption/);
  assert.throws(() => hero({stat: {value: 1, label: 'x'}, flow: steps(), layout: 'wide' as never}), /layout must be/);
});
