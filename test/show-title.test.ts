import test from 'node:test';
import assert from 'node:assert/strict';
import {box, caption, checkDiagram, closeMeasurer, diagram, renderDiagram} from '../lib/dsl.ts';
import {withTitleLine} from '../lib/layout-util.ts';

test.after(() => closeMeasurer());

test('showTitle draws the title as the first band; without it nothing changes', async () => {
  const plain = diagram({theme: 'blue', title: '離職の流れ'}).add(box({title: 'a'}));
  const shown = diagram({theme: 'blue', title: '離職の流れ', showTitle: true}).add(box({title: 'a'}));
  const a = await renderDiagram(plain, {name: 'a.svg', budget: 'cacheOnly'});
  const b = await renderDiagram(shown, {name: 'b.svg', budget: 'cacheOnly'});
  assert.ok(!/>離職の流れ<\/text>/.test(a.svg), 'the title is only metadata without showTitle');
  assert.match(b.svg, />離職の流れ<\/text>/);
  const {laidOut} = await checkDiagram(shown);
  const first = laidOut.laidOut[0]!;
  assert.equal(first.type, 'caption');
  assert.ok(laidOut.laidOut[1]!.y > first.y, 'the figure follows the title');
});

test('showTitle needs a title, and a boolean', () => {
  assert.throws(() => diagram({theme: 'blue', showTitle: true}), /needs a title/);
  assert.throws(() => diagram({theme: 'blue', title: 'x', showTitle: 'yes' as never}), /true or false/);
});

test('a title and an identical first caption get an info that points at showTitle', async () => {
  const d = diagram({theme: 'blue', title: '題名'}).add(caption('題名', {bold: true, tone: 'text'}), box({title: 'a'}));
  const {verdict} = await checkDiagram(d);
  assert.ok(verdict.findings.some(f => f.rule === 'title-duplicated' && f.severity === 'info'));
  const once = diagram({theme: 'blue', title: '題名', showTitle: true}).add(box({title: 'a'}));
  assert.ok(!(await checkDiagram(once)).verdict.findings.some(f => f.rule === 'title-duplicated'));
});

test('withTitleLine puts the title caption first, and leaves a diagram without showTitle as it is', () => {
  const base = diagram({theme: 'blue', title: 'T'}).add(box({title: 'a'}));
  assert.equal(withTitleLine(base), base);
  const shown = withTitleLine(diagram({theme: 'blue', title: 'T', showTitle: true}).add(box({title: 'a'})));
  assert.equal(shown.bands.length, 2);
  assert.deepEqual([shown.bands[0]!.type, (shown.bands[0] as {titleLine?: boolean}).titleLine], ['caption', true]);
});
