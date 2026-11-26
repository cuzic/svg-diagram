// steps({numbered}): the number badge must not break a short title into 2-character pieces; the badge takes its own line when the title does not fit beside it.
import test from 'node:test';
import assert from 'node:assert/strict';
import {closeMeasurer} from '../lib/dsl.ts';
import {configureMeasure} from '../lib/measure.ts';
import {installResolveHook} from '../lib/resolve-hook.ts';
import {renderDeckFigure} from '../lib/deck-render-figure.ts';
import {stepBadgeAt} from '../lib/box-step-geometry.ts';
import type {Config} from '../lib/types/project.ts';
import type {LaidOutBox} from '../lib/types/text-bands.ts';
import {JA_FONTS} from './helpers/text-engine.ts';

const cfg: Config = {measure: 'font', fonts: JA_FONTS};
installResolveHook();
configureMeasure(cfg);
test.after(() => closeMeasurer());

const SHORT = ['下見', '見積作成', '契約手続', '発注準備', '納品確認'];
const MIXED = ['下見', '見積作成手順書', '契約', '発注準備中', '納品確認報告書'];
const draw = async (titles: string[], numbered: boolean, width: number) => {
  const spec = {version: 1, title: 't', width, parts: [{type: 'steps', numbered, items: titles.map(title => ({title})), loopBack: [{from: 5, to: 1, label: '戻る'}]}]};
  const r = await renderDeckFigure(0, spec, undefined, cfg);
  assert.ok(r.ok);
  const lo = r.result.laidOut;
  const row = lo.laidOut.find(b => b.type === 'row');
  assert.ok(row && 'children' in row);
  return {boxes: row.children as LaidOutBox[], svg: r.result.svg, problems: r.result.verdict.problems};
};
const lines = (b: LaidOutBox) => b.wrappedRuns[0]!.lines;

test('numbered steps keep a title on one line wherever the unnumbered one does (deck figure, several widths)', async () => {
  for (const width of [940, 760, 620]) {
    const plain = await draw(SHORT, false, width), num = await draw(SHORT, true, width);
    assert.deepEqual(num.problems, []);
    num.boxes.forEach((b, i) => assert.equal(lines(b).length, lines(plain.boxes[i]!).length, `${width}px step ${i + 1}: ${lines(b).join('/')}`));
    num.boxes.forEach(b => assert.equal(lines(b).length, 1, `${width}px: ${lines(b).join('/')}`));
  }
});

test('a title that has to wrap anyway wraps as it does unnumbered, never into 1-2 character pieces', async () => {
  for (const width of [940, 760, 620]) {
    const plain = await draw(MIXED, false, width), num = await draw(MIXED, true, width);
    num.boxes.forEach((b, i) => {
      const beside = lines(b), alone = lines(plain.boxes[i]!);
      assert.ok(beside.length <= alone.length + 1, `${width}px step ${i + 1}: ${beside.join('/')} vs ${alone.join('/')}`);
      if (alone.length < beside.length) assert.ok(beside.every(l => [...l].length > 2), beside.join('/'));
    });
  }
});

test('the badge sits above the title when it does not fit beside it, and beside it otherwise; loopBack still draws', async () => {
  const narrow = await draw(SHORT, true, 620), wide = await draw(SHORT, true, 940);
  for (const b of narrow.boxes) {
    assert.equal(b.stepAbove, true);
    const g = stepBadgeAt(b), titleTop = b.y + (b.padY ?? 14) + b.wrappedRuns[0]!.lineYs[0]! - b.wrappedRuns[0]!.size;
    assert.ok(g.cy + g.r <= titleTop + 0.5, 'the badge ends before the title starts');
    assert.ok(g.cx - g.r >= b.x && g.cx + g.r <= b.x + b.w);
  }
  for (const b of wide.boxes) assert.ok(!b.stepAbove, 'room beside the title: the badge stays beside it');
  assert.match(narrow.svg, /戻る/);
});
