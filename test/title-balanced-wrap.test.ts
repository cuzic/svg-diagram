// A title that needs two lines is broken so the lines are alike in length: no stub of one or two characters on the last line
// (cover title and slide heading). `\n` in a title forces a break. The titles are made up.
import test from 'node:test';
import assert from 'node:assert/strict';
import {planDeckLayout, type TextBlock, type TextWidth} from '../lib/deck-layout.ts';
import {planDeckSlide} from '../lib/pptx/deck.ts';
import {fontsOf} from '../lib/pptx/slide.ts';
import {wrapBalanced, wrapText} from '../lib/wrap.ts';

const fixed: TextWidth = (t, size) => [...t].length * size;
const lines = (blocks: readonly unknown[], name: string): string[] => {
  const b = blocks.find((x): x is TextBlock => (x as TextBlock).kind === 'text' && (x as TextBlock).name === name);
  return (b?.lines ?? []).map(l => l.map(r => r.text).join(''));
};
const TITLE20 = 'あいうえおかきくけこさしすせそたちつてと'; // 20 full-width characters: 18 + 2 when filled greedily at 56 px in 1040 px
const cover = (title: string) => planDeckLayout({layout: 'cover', title}, undefined, fixed);

test('cover title: the greedy wrap leaves a 2-character last line; the balanced wrap does not', () => {
  assert.deepEqual(wrapText(TITLE20, {maxWidth: 1040, atomWidth: a => fixed(a, 56, true), mode: 'phrase'}).map(l => [...l].length), [18, 2], 'the repro: what main did');
  const got = lines(cover(TITLE20).top, 'title');
  assert.equal(got.join(''), TITLE20);
  assert.deepEqual(got.map(l => [...l].length), [10, 10]);
});

test('cover title: three lines are balanced too, and the last line is never under 4 characters', () => {
  const t = 'あ'.repeat(37);
  const got = lines(planDeckLayout({layout: 'cover', title: t}, undefined, fixed).top, 'title').map(l => [...l].length);
  assert.ok(got.length >= 2);
  assert.ok(Math.min(...got) >= 4, String(got));
  assert.ok(Math.max(...got) - Math.min(...got) <= 1, String(got));
});

test('kinsoku holds in the balanced wrap: a line does not start with 。 or ー', () => {
  const got = wrapBalanced('あいうえおかきくけこ。さしすせそたちつてと', {maxWidth: 19, atomWidth: () => 1, mode: 'phrase'});
  assert.equal(got.join(''), 'あいうえおかきくけこ。さしすせそたちつてと');
  for (const l of got.slice(1)) assert.ok(!/^[。ー、]/.test(l), l);
});

test('a line that already is short stays one line, and \\n forces a break (each part balanced on its own)', () => {
  assert.deepEqual(lines(cover('図で伝える').top, 'title'), ['図で伝える']);
  assert.deepEqual(lines(cover('はじめの行\nつぎの行').top, 'title'), ['はじめの行', 'つぎの行']);
  const opts = {maxWidth: 18, atomWidth: () => 1, mode: 'phrase' as const};
  assert.deepEqual(wrapBalanced(`${TITLE20}\nおわり`, opts).map(l => [...l].length), [10, 10, 3]);
  assert.deepEqual(wrapText(`${TITLE20}\nおわり`, opts).map(l => [...l].length), [18, 2, 3], 'main: the stub');
});

test('English titles still break at spaces only', () => {
  const t = 'Designing readable diagrams for every audience in the room today';
  const got = wrapBalanced(t, {maxWidth: 40, atomWidth: a => [...a].length, mode: 'phrase'});
  assert.equal(got.join(' '), t);
  assert.ok(got.length >= 2);
  assert.ok(Math.min(...got.map(l => l.length)) >= 12, got.join('|'));
  assert.ok(Math.max(...got.map(l => l.length)) <= 40);
});

test('an ordinary slide heading is balanced the same way', () => {
  const got = lines(planDeckLayout({title: 'あ'.repeat(40)}, undefined, fixed).top, 'title').map(l => [...l].length);
  assert.equal(got.length, 2);
  assert.ok(Math.min(...got) >= 4, String(got));
  assert.ok(Math.max(...got) - Math.min(...got) <= 1, String(got));
});

test('PPTX: the cover title text boxes carry the balanced lines', () => {
  const p = planDeckSlide({layout: 'cover', title: TITLE20}, fontsOf(), fixed);
  const m = p.xml.match(/<a:t>([^<]*)<\/a:t>/g)?.map(x => x.replace(/<\/?a:t>/g, '')) ?? [];
  assert.deepEqual(m.filter(x => x.length > 0 && TITLE20.includes(x)).map(l => [...l].length), [10, 10]);
});

const em = {atomWidth: (a: string) => [...a].length, mode: 'phrase' as const};

test('M1: the balanced width never goes under a katakana or kanji run, or a colon break the greedy wrap kept', () => {
  const kata = 'コミュニケーションプラットフォーム移行プロジェクトの振り返り';
  assert.deepEqual(wrapBalanced(kata, {...em, maxWidth: 24}), ['コミュニケーションプラットフォーム', '移行プロジェクトの振り返り']);
  const kanji = '国立研究開発法人情報通信研究機構との共同研究成果';
  const k = wrapBalanced(kanji, {...em, maxWidth: 22});
  assert.ok(k[0]?.startsWith('国立研究開発法人情報通信研究機構'), k.join('|'));
  const colon = wrapBalanced('はじめに：オブザーバビリティプラットフォーム', {...em, maxWidth: 14});
  assert.ok(colon.every(l => !/オブザーバビ$/.test(l)), colon.join('|'));
  assert.deepEqual(wrapBalanced(TITLE20, {...em, maxWidth: 18}).map(l => [...l].length), [10, 10], 'hiragana still balances');
});

test('m1: a blank line written with \\n\\n is kept', () => {
  assert.deepEqual(wrapBalanced('第一部\n\n図で伝える', {...em, maxWidth: 20}), ['第一部', '', '図で伝える']);
});

test('m2: a break after a clause mark is preferred when the lines are nearly as even', () => {
  const t = 'あたらしい設計の考え方、そしてその運用の話をします';
  const got = wrapBalanced(t, {...em, maxWidth: 24});
  assert.equal(got.join(''), t);
  assert.ok(got[0]?.endsWith('、'), got.join('|'));
});
