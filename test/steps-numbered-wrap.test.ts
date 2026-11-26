// steps({numbered}): the number badge must not break a short title into 2-character pieces; the badge takes its own line when the title does not fit beside it.
import test from 'node:test';
import assert from 'node:assert/strict';
import {closeMeasurer} from '../lib/dsl.ts';
import {configureMeasure} from '../lib/measure.ts';
import {installResolveHook} from '../lib/resolve-hook.ts';
import {renderDeckFigure} from '../lib/deck-render-figure.ts';
import {stepBadgeAt} from '../lib/box-step-geometry.ts';
import {renderPptxEdge} from '../lib/pptx-edge.ts';
import {unzipEntry} from './helpers/pptx/unzip.ts';
import {box, checkDiagram, diagram, row, steps} from '../lib/dsl.ts';
import type {Config} from '../lib/types/project.ts';
import type {LaidOutBox} from '../lib/types/text-bands.ts';
import {JA_FONTS, realEngine} from './helpers/text-engine.ts';

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

test('numbered steps never leave a 1-character piece a title does not leave unnumbered; at 620px every title is on one line', async () => {
  for (const width of [940, 760, 700, 620]) {
    const plain = await draw(SHORT, false, width), num = await draw(SHORT, true, width);
    assert.deepEqual(num.problems, []);
    num.boxes.forEach((b, i) => {
      const alone = lines(plain.boxes[i]!);
      assert.ok(!lines(b).some(l => [...l].length <= 1) || alone.some(l => [...l].length <= 1), `${width}px step ${i + 1}: ${lines(b).join('/')}`);
      if (width === 620) assert.equal(lines(b).length, 1, lines(b).join('/'));
    });
  }
});

test('a title that has to wrap anyway wraps as it does unnumbered, never into a 1-character piece', async () => {
  for (const width of [940, 760, 700]) {
    const plain = await draw(MIXED, false, width), num = await draw(MIXED, true, width);
    num.boxes.forEach((b, i) => {
      const beside = lines(b), alone = lines(plain.boxes[i]!);
      assert.ok(beside.length <= alone.length + 1, `${width}px step ${i + 1}: ${beside.join('/')} vs ${alone.join('/')}`);
      if (alone.length < beside.length) assert.ok(beside.every(l => [...l].length > 1), beside.join('/'));
    });
  }
});

test('one steps row, one placement: where some title would break into a 1-character piece, every badge goes above (widths 700 and 760)', async () => {
  for (const width of [700, 760]) {
    const titles = width === 700 ? MIXED : ['下見', '見積作成手順書', '契約', '発注準備中', '納品確認報告書'];
    const {boxes} = await draw(titles, true, width);
    const above = boxes.map(b => !!b.stepAbove);
    assert.ok(above.every(a => a === above[0]), `${width}px: ${above.join()}`);
    const baselines = boxes.map(b => b.wrappedRuns[0]!.lineYs[0]);
    assert.equal(new Set(baselines).size, 1, `${width}px baselines: ${baselines.join()}`);
  }
  assert.ok((await draw(MIXED, true, 700)).boxes.every(b => b.stepAbove), 'the width where some titles fragment');
});

test('only a real fragment moves the badge: clean 2+2 breaks, and titles that wrap just as many lines alone, stay beside it', async () => {
  const clean = await draw(SHORT, true, 700); // 見積/作成 beside the badge, no 1-character piece
  assert.ok(clean.boxes.every(b => !b.stepAbove), clean.boxes.map(b => lines(b).join('/')).join(' '));
  const narrow = await draw(MIXED, true, 360); // so narrow the title fragments without the badge too: nothing to gain
  assert.ok(narrow.boxes.every(b => !b.stepAbove));
});

test('a step box with an icon keeps its badge beside the title; a plain box({step}) is as before', async () => {
  for (const width of [480, 560, 640, 720, 800, 880, 940]) { // wherever the icon and the badge together leave a title in pieces, the badge stays beside it
    const iconed = await checkDiagram(diagram({theme: 'blue', title: 't', width}).add(steps(SHORT.map(title => ({title, icon: 'shield' as const})), {numbered: true})));
    const rowBand = iconed.laidOut.laidOut.find(b => b.type === 'row');
    assert.ok(rowBand && 'children' in rowBand);
    assert.ok((rowBand.children as LaidOutBox[]).every(b => !b.stepAbove), `${width}px`);
  }
  const plain = await checkDiagram(diagram({theme: 'blue', title: 't', width: 560}).add(row(SHORT.map((title, i) => box({title, step: i + 1})), {arrows: 'none'})));
  const pr = plain.laidOut.laidOut.find(b => b.type === 'row');
  assert.ok(pr && 'children' in pr);
  assert.ok((pr.children as LaidOutBox[]).every(b => !b.stepAbove));
});

test('a badge above a centred or right-aligned title sits on its alignment, clear of the title', () => {
  const base = {x: 100, y: 50, w: 160, padX: 16, padY: 14, wrappedRuns: [{lineYs: [60], size: 17}], stepAbove: true} as never as LaidOutBox;
  const c = stepBadgeAt({...base, align: 'center'}), l = stepBadgeAt({...base, align: 'left'}), r = stepBadgeAt({...base, align: 'right'});
  assert.equal(c.cx, 180);
  assert.equal(l.cx, 100 + 16 + l.r);
  assert.equal(r.cx, 100 + 160 - 16 - r.r);
  for (const g of [c, l, r]) assert.equal(g.cy, 50 + 14 + g.r);
});

test('PPTX: the badge of a badge-above box ends above the title text (the text inset), at the same place the svg puts it', async () => {
  const spec = {version: 1, title: 't', width: 620, parts: [{type: 'steps', numbered: true, items: SHORT.map(title => ({title}))}]};
  const r = await renderPptxEdge(spec as never, realEngine(), {rasterize: () => new Uint8Array([1])});
  const xml = unzipEntry(Buffer.from(r.pptx!), 'ppt/slides/slide1.xml').toString();
  const groups = xml.split('<p:grpSp>').slice(2).filter(g => g.includes('name="step: '));
  assert.equal(groups.length, 5);
  for (const g of groups) {
    const num = (re: RegExp) => Number(re.exec(g)?.[1]);
    const boxY = num(/name="box: [^>]*><[\s\S]*?<a:off x="\d+" y="(\d+)"/), inset = num(/tIns="(\d+)"/);
    const badge = /name="step: \d+"[\s\S]*?<a:off x="\d+" y="(\d+)"\/><a:ext cx="\d+" cy="(\d+)"/.exec(g)!;
    assert.equal(Number(badge[1]) - boxY, 152400, 'the badge starts at the box padding (14px)');
    assert.ok(Number(badge[1]) + Number(badge[2]) <= boxY + inset, 'the badge ends before the text starts');
  }
});
