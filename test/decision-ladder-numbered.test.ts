// decisionLadder() U4 (ADR 0083): numbered questions, even row spacing, a packed height and the finding that says what is left.
import test from 'node:test';
import './helpers/strict-width.ts';
import assert from 'node:assert/strict';
import {checkDiagram, closeMeasurer, decisionLadder, diagram, renderDiagram} from '../lib/dsl.ts';
import {LADDER_SLIDE_ASPECT, tooTall} from '../lib/layout-util.ts';
import type {LaidOutStates} from '../lib/types/diagrams.ts';

test.after(() => closeMeasurer());

const LONG = '延長は 1 回まで。詳しい条件は受付の掲示を見るか、係の人に尋ねる';
const STEPS = [
  {q: '利用者カードは持っている？', yes: '貸出カウンターへ進む'},
  {q: '返却の期限は過ぎていない？', yes: '延滞の手続きを案内する', sub: LONG},
  {q: '予約した本は届いている？', yes: '予約棚から取り出す'},
  {q: '館内で読むだけ？', yes: '閲覧席へ案内する', sub: LONG},
  {q: '次回の入荷を待てる？', yes: '入荷の連絡を登録する'},
];
const END = '後日の来館をお願いする';
type R = {x: number; y: number; w: number; h: number};
const laid = async (band: ReturnType<typeof decisionLadder>, opts: {width?: number; density?: 'normal' | 'compact'} = {}) => {
  const d = diagram({theme: 'blue', title: 't', ...opts}).add(band), {laidOut, verdict} = await checkDiagram(d);
  return {t: laidOut.laidOut.find((b): b is LaidOutStates => b.type === 'states')!, verdict, svg: (await renderDiagram(d, {name: 'x.svg', budget: 'cacheOnly'})).svg};
};
const rect = (t: LaidOutStates, id: string): R => t.anchors.find(a => a.id === id)!;
const gaps = (t: LaidOutStates, ids: string[]): number[] => ids.slice(1).map((id, i) => rect(t, id).y - (rect(t, ids[i]!).y + rect(t, ids[i]!).h));
const QS = ['q1', 'q2', 'q3', 'q4', 'q5', 'otherwise'], AS = ['a1', 'a2', 'a3', 'a4', 'a5'];

test('numbered: each question carries a badge 1..N inside its box at the left, the text clear of it; answers and the final box carry none', async () => {
  const {t, svg} = await laid(decisionLadder(STEPS, END, {numbered: true}), {width: 900});
  assert.deepEqual(t.badges!.map(b => b.label), ['1', '2', '3', '4', '5']);
  t.badges!.forEach((b, i) => {
    const q = rect(t, `q${i + 1}`);
    assert.ok(b.cx - b.r >= q.x && b.cx + b.r <= q.x + q.w && b.cy - b.r >= q.y && b.cy + b.r <= q.y + q.h, `badge ${i + 1} inside its box`);
    assert.equal(b.cy, q.y + q.h / 2);
    for (const x of t.texts.filter(x => x.bold && x.y > q.y && x.y < q.y + q.h && x.x > q.x && x.x < q.x + q.w)) assert.ok(x.x > b.cx + b.r, `text "${x.text}" is centred right of the badge`);
  });
  assert.equal([...svg.matchAll(/data-badge/g)].length, 5);
  assert.match(svg, /aria-label="質問 3"/);
  // the badge is the one box({step}) draws: the same radius and fill
  assert.equal(t.badges![0]!.r, 15);
});

test('numbered: the question text is wrapped in what the badge leaves, so a text never runs under it', async () => {
  const {t} = await laid(decisionLadder([{q: '返却の期限は過ぎていないので、延長の手続きを案内してよい？', yes: '手続きへ'}], END, {numbered: true}), {width: 420});
  const b = t.badges![0]!, q = rect(t, 'q1');
  const lines = t.texts.filter(x => x.bold && x.y > q.y && x.y < q.y + q.h);
  assert.ok(lines.length >= 2, 'wrapped');
  for (const l of lines) assert.ok(l.x > b.cx + b.r, 'centre right of the badge');
  assert.ok(q.w > 0 && b.cx + b.r < q.x + q.w);
});

test('without numbered the figure has no badge, and numbered: false is the same figure', async () => {
  const a = await laid(decisionLadder(STEPS, END), {width: 900}), b = await laid(decisionLadder(STEPS, END, {numbered: false}), {width: 900});
  assert.equal(a.t.badges, undefined);
  assert.equal(a.svg, b.svg);
  assert.ok(!/data-badge/.test(a.svg));
});

test('numbered: the input messages', () => {
  assert.throws(() => decisionLadder(STEPS, END, {numbered: 'yes' as never}), /numbered must be true or false \(got yes\)/);
  assert.throws(() => decisionLadder(STEPS, END, {numbered: true, question: 'diamond'}), /numbered needs question: 'box'/);
  assert.doesNotThrow(() => decisionLadder(STEPS, END, {numbered: false, question: 'diamond'}));
});

test('even spacing: the gap between two boxes is the same down the questions, down the answers and down the rows, whatever an answer\'s second line adds', async () => {
  for (const width of [640, 900, 940]) {
    const {t} = await laid(decisionLadder(STEPS, END), {width});
    const q = gaps(t, QS), a = gaps(t, AS);
    assert.equal(new Set(q).size, 1, `question gaps at ${width}: ${q}`);
    assert.equal(new Set(a).size, 1, `answer gaps at ${width}: ${a}`);
    assert.equal(q[0], a[0]);
    // the rows line up: a question box and its answer box have the same top and height
    for (let i = 1; i <= 5; i++) { assert.equal(rect(t, `q${i}`).y, rect(t, `a${i}`).y); assert.equal(rect(t, `q${i}`).h, rect(t, `a${i}`).h); }
  }
});

test('a wide answer column keeps a long sub on one line when the figure is wide enough, and wraps it when it is not', async () => {
  const wide = await laid(decisionLadder(STEPS, END), {width: 900}), narrow = await laid(decisionLadder(STEPS, END), {width: 640});
  assert.equal(wide.t.texts.filter(x => x.muted).length, 2, 'one line each');
  assert.ok(narrow.t.texts.filter(x => x.muted).length > 2, 'wrapped at 640');
  assert.ok(wide.t.h < narrow.t.h, `${wide.t.h} < ${narrow.t.h}`);
  // an explicit maxNodeW still caps the answers
  const capped = await laid(decisionLadder(STEPS, END, {maxNodeW: 240}), {width: 900});
  assert.ok(rect(capped.t, 'a2').w <= 240 + 8);
});

test('a figure taller than a 16:9 slide allows packs its row gaps (not below the floor); a short one keeps 32', async () => {
  const short = await laid(decisionLadder(STEPS.slice(0, 2), END), {width: 900});
  assert.equal(gaps(short.t, ['q1', 'q2', 'otherwise'])[0], 32);
  const tall = await laid(decisionLadder(STEPS, END), {width: 900});
  const g = gaps(tall.t, QS)[0]!;
  assert.ok(g < 32 && g >= 20, `${g}`);
  const tight = await laid(decisionLadder(STEPS, END), {width: 640});
  assert.ok(gaps(tight.t, QS)[0]! >= 24, 'the chips still fit');
});

test('ladder-height-bound: said when the figure is still too tall for a 16:9 slide, silent when it is not', async () => {
  const many = Array.from({length: 8}, (_, i) => ({q: `${i + 1} 番目の確認はできている？`, yes: `${i + 1} 番の窓口へ`, sub: '詳しくは掲示を見る'}));
  const tall = await laid(decisionLadder(many, END), {width: 900});
  const f = tall.verdict.findings.find(x => x.rule === 'ladder-height-bound');
  assert.ok(f, 'the finding');
  assert.equal(f.severity, 'info');
  assert.match(f.message, /高さで大きさが決まり|diagram\(\{width: \d+\}\)/);
  assert.doesNotMatch(f.message, /compact/);
  const ok = await laid(decisionLadder(STEPS.slice(0, 3), END), {width: 900});
  assert.ok(!ok.verdict.findings.some(x => x.rule === 'ladder-height-bound'));
});

test('PPTX: a numbered ladder draws its badges as native circles named step, with the number as text', async () => {
  const {prepareBands} = await import('../lib/core.ts');
  const {planPreparedPptx} = await import('../lib/pptx/selective.ts');
  const {statesPptx} = await import('../lib/pptx/states-band.ts');
  const {decisionLadder: ladderBand} = await import('../lib/bands/states.ts');
  const opts = {measure: ({text, size}: {text: string; size: number}) => ({w: [...text].length * size * 0.6, h: size}), title: '受付'};
  const selected = planPreparedPptx(await prepareBands([ladderBand(STEPS.slice(0, 3), END, {numbered: true})], opts), {...opts, bands: {states: statesPptx}, strict: true});
  assert.deepEqual(selected.fallbacks, []);
  assert.equal([...selected.plan.xml.matchAll(/name="[^"]*step[^"]*"/g)].length, 3);
  for (const n of ['1', '2', '3']) assert.match(selected.plan.xml, new RegExp(`<a:t>${n}</a:t>`));
});

test('tooTall: the diagram (the band and its 40px margins) against 0.47 of its width', () => {
  assert.equal(LADDER_SLIDE_ASPECT, 0.47);
  assert.equal(tooTall(383, 860), false); // 423 / 900 = 0.470
  assert.equal(tooTall(384, 860), true);
  assert.equal(tooTall(368, 600), true);
  assert.equal(tooTall(200, 600), false);
});

const finding = async (width: number) => (await laid(decisionLadder(STEPS, END), {width})).verdict.findings.find(x => x.rule === 'ladder-height-bound');

test('ladder-height-bound names the width at which every sub is on one line, and which way to go', async () => {
  const wrapped = await laid(decisionLadder(STEPS, END), {width: 640});
  const one = wrapped.t.oneLineW!;
  assert.ok(one > 600 && one < 860, `${one}`);
  const at = await laid(decisionLadder(STEPS, END), {width: one + 40});
  assert.equal(at.t.texts.filter(x => x.muted).length, 2, 'one line each at the width it names');
  const below = await laid(decisionLadder(STEPS, END), {width: one + 40 - 16});
  assert.ok(below.t.texts.filter(x => x.muted).length > 2, 'wrapped narrower than the width it names');
  // narrower: widen to it
  assert.match((await finding(640))!.message, new RegExp(`diagram\\(\\{width: ${one + 40}\\}\\)に?広げる|diagram\\(\\{width: ${one + 40}\\}\\) に広げる`));
  // wider (the slide's width binds): narrow to it, and the finding does not say that width is useless
  const wide = (await finding(900))!.message;
  assert.match(wide, new RegExp(`diagram\\(\\{width: ${one + 40}\\}\\) まで狭められる`));
  assert.doesNotMatch(wide, /幅を変えても文字は大きくならない/);
  // at the width itself nothing narrower or wider helps: the height binds
  const here = (await finding(one + 40))!.message;
  assert.match(here, /高さで大きさが決まり/);
  assert.doesNotMatch(here, /に広げる|狭められる/);
});

test('the gap floor: with arrow words the label height (25px), without them 20px', async () => {
  const bare = await laid(decisionLadder(STEPS, END, {yes: '', no: ''}), {width: 640});
  assert.equal(gaps(bare.t, QS)[0], 20);
  const worded = await laid(decisionLadder(STEPS, END), {width: 640});
  assert.equal(gaps(worded.t, QS)[0], 25);
});

test('PPTX: a numbered question and its badge are one group, so they move together', async () => {
  const {prepareBands} = await import('../lib/core.ts');
  const {planPreparedPptx} = await import('../lib/pptx/selective.ts');
  const {statesPptx} = await import('../lib/pptx/states-band.ts');
  const {decisionLadder: ladderBand} = await import('../lib/bands/states.ts');
  const opts = {measure: ({text, size}: {text: string; size: number}) => ({w: [...text].length * size * 0.6, h: size}), title: '受付'};
  const xml = planPreparedPptx(await prepareBands([ladderBand(STEPS.slice(0, 2), END, {numbered: true})], opts), {...opts, bands: {states: statesPptx}, strict: true}).plan.xml;
  const groups = [...xml.matchAll(/<p:grpSp>(?:(?!<p:grpSp>)[\s\S])*?<\/p:grpSp>/g)].map(m => m[0]).filter(g => /name="[^"]*step/.test(g));
  assert.equal(groups.length, 2);
  for (const g of groups) assert.match(g, /<a:t>利用者カードは持っている？|<a:t>返却の期限は過ぎていない？/);
});
