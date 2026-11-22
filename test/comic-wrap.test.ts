// ADR 0074 D2: the width rule, the template, and how a bubble's text is wrapped (the nine sentence patterns, the glue rule, orphan lines).
import test from 'node:test';
import assert from 'node:assert/strict';
import {parseTemplate, fillTemplate, slotIdsOf} from '../lib/comic/template.ts';
import {reserveAtoms, reserveDialogue} from '../lib/comic/reserve.ts';
import {bubbleHeight} from '../lib/comic/layout.ts';
import {comicAtomWidth, isFullWidth, isHiragana} from '../lib/comic/width.ts';
import {comicMeasure} from '../lib/comic/measure.ts';
import {comic} from '../lib/dsl-pure.ts';

const noMeasure = () => { throw new Error('a full-width atom is never measured'); };
const wrapped = (tpl: string, max: number, widthOf = noMeasure) => {
  const R = reserveDialogue(parseTemplate(tpl), () => max, a => comicAtomWidth(a, widthOf));
  return {box: `${Math.ceil((R.inner + 24) / 4) * 4}x${bubbleHeight(R.lines.length)}`, lines: R.lines.map(l => l.atoms.map(a => a.text).join('')), notes: R.notes};
};

test('the width rule: a full-width atom is exactly 1 em and never measured; any other atom is rounded to 1/4 px, then up to a whole px', () => {
  for (const a of ['あ', 'ア', '漢', '、', '。', '！', '？', '…', 'ー']) assert.equal(comicAtomWidth(a, noMeasure), 18, a);
  const at = (w: number) => comicAtomWidth('Ab', () => w);
  assert.equal(at(16), 16);
  assert.equal(at(16.0156), 16);
  assert.equal(at(16.12), 16); // 16.12 rounds to 16.0 (1/4 px), whole px: 16
  assert.equal(at(16.13), 17); // 16.13 rounds to 16.25, up to 17: the cliff sits at k + 0.125
  assert.equal(at(0), 0);
  assert.ok(isFullWidth('あ') && !isFullWidth('a') && !isFullWidth('ab'));
  assert.ok(isHiragana('あ') && !isHiragana('ア') && !isHiragana('漢') && !isHiragana('ああ'));
});

test('parseTemplate: blanks {id}, {{ and }} are the braces themselves, a stray brace throws', () => {
  assert.deepEqual(parseTemplate('最近、{change}ね。'), [{lit: '最近、'}, {slot: 'change'}, {lit: 'ね。'}]);
  assert.deepEqual(parseTemplate('{{a}}'), [{lit: '{a}'}]);
  assert.deepEqual(parseTemplate('{a-1}{b_2}'), [{slot: 'a-1'}, {slot: 'b_2'}]);
  assert.throws(() => parseTemplate('{}'), /not a blank/);
  assert.throws(() => parseTemplate('{a.b}'), /not a blank/);
  assert.throws(() => parseTemplate('{a'), /not a blank/);
  assert.throws(() => parseTemplate('a}'), /no blank before/);
  const parts = parseTemplate('{x}と{y}');
  assert.deepEqual(slotIdsOf(parts), ['x', 'y']);
  assert.equal(fillTemplate(parts, id => `[${id}]`), '[x]と[y]');
});

// The nine sentence patterns of ADR 0074 U1 (fit2q, 18px; max is the blank's width). The expected values are what the rule makes of them, the
// imperfect breaks ("{p}してお / きます。") included: the ADR keeps them as a record, and the number of breaks inside a hiragana run must not grow.
const NINE: [string, number, string, string[]][] = [
  ['先に{p}しておきます。', 6, '188x100', ['先に', '{p}してお', 'きます。']],
  ['{p}しておきます。', 6, '188x72', ['{p}してお', 'きます。']],
  ['明日までに{p}をお願いしてもいいですか？', 6, '204x100', ['明日までに', '{p}をお願', 'いしてもいいですか？']],
  ['{p}だと思っているんですけど…', 6, '204x72', ['{p}だと思っ', 'ているんですけど…']],
  ['最近、{p}ですね。', 9, '188x100', ['最近、', '{p}', 'ですね。']],
  ['{p}してもらえると助かります。', 9, '188x100', ['{p}', 'してもらえると', '助かります。']],
  ['ちょっと{p}かもしれません。', 4, '188x100', ['ちょっと', '{p}かもしれま', 'せん。']],
  ['{p}', 9, '188x48', ['{p}']],
  ['今日は{p}の予定があるので、先に帰ります。', 9, '204x124', ['今日は', '{p}の', '予定があるので、先に', '帰ります。']],
];
for (const [tpl, max, box, lines] of NINE) {
  test(`nine patterns: ${tpl}`, () => {
    const r = wrapped(tpl, max);
    assert.equal(r.box, box);
    assert.deepEqual(r.lines, lines);
  });
}

test('nine patterns: the boxes keep two bubbles side by side (188 + 204 <= 404px), and breaks inside a hiragana run are no more than the same sentence in kanji', () => {
  const hira = (c?: string) => !!c && /[ぁ-ゟ]/.test(c);
  const splits = (lines: string[]) => lines.filter((l, i) => i > 0 && hira(l[0]) && hira(lines[i - 1]!.at(-1))).length;
  let withBlank = 0, literal = 0;
  for (const [tpl, max] of NINE) {
    const w = Number(wrapped(tpl, max).box.split('x')[0]);
    assert.ok(w === 188 || w === 204, `${tpl}: ${w}`);
    withBlank += splits(wrapped(tpl, max).lines);
    literal += splits(wrapped(tpl.replace('{p}', '漢'.repeat(max)), 0).lines);
  }
  assert.equal(withBlank, 4);
  assert.equal(literal, 4);
});

test('the glue rule: a particle after a blank stays with it, but the で of です is not taken for one', () => {
  assert.deepEqual(wrapped('{p}を確認する。', 9).lines, ['{p}を', '確認する。']); // を is bound although the blank fills the line
  assert.deepEqual(wrapped('最近、{p}ですね。', 9).lines, ['最近、', '{p}', 'ですね。']); // the で of です is not bound: the break after the blank is the natural one
  assert.deepEqual(wrapped('今日は{p}の予定。', 9).lines, ['今日は', '{p}の', '予定。']);
});

test('the glue rule binds at most two hiragana after the blank (when more fit, the third is left to the line break)', () => {
  assert.deepEqual(wrapped('ああ{p}してもらえます。', 5).lines, ['ああ{p}して', 'もらえます。']);
  assert.deepEqual(wrapped('ああ{p}かもしれません。', 5).lines, ['ああ{p}かも', 'しれません。']);
});

test('a blank wider than the nine characters widens the text block to fit it (never narrower than 162px), and past 11 characters it is reported', () => {
  assert.equal(reserveDialogue(parseTemplate('{p}'), () => 9, a => comicAtomWidth(a, noMeasure)).inner, 162);
  const wide = reserveDialogue(parseTemplate('{p}'), () => 12, a => comicAtomWidth(a, noMeasure));
  assert.equal(wide.inner, 216);
  assert.deepEqual(wide.notes, ['bubble-wide']);
});

test('an orphan last line (2 characters or fewer) is cured by widening one or two characters; reported when widening cannot', () => {
  // 10 characters would leave 1 on the second line: one character wider fits them (180px); 11 take two characters wider (198px)
  assert.deepEqual([10, 11, 12].map(n => wrapped('漢'.repeat(n), 1).lines.map(l => [...l].length)), [[10], [11], [9, 3]]);
  assert.deepEqual([10, 11, 12].map(n => wrapped('漢'.repeat(n), 1).box.split('x')[0]), ['204', '224', '188']);
  // 19 characters: 9 + 9 + 1 becomes 10 + 9
  assert.deepEqual(wrapped('漢'.repeat(19), 1).lines.map(l => [...l].length), [10, 9]);
  // an atom that cannot be widened around: 190px wide, then one character. 162 + 36 = 198 < 208, so the orphan stays, and is reported
  const stuck = reserveAtoms([{text: 'W', w: 190}, {text: 'あ', w: 18}]);
  assert.deepEqual(stuck.lines.map(l => l.atoms.map(a => a.text).join('')), ['W', 'あ']);
  assert.deepEqual(stuck.notes, ['orphan-line']);
  assert.equal(stuck.inner, 190);
  assert.deepEqual(reserveAtoms([{text: 'W', w: 200}]).notes, ['bubble-wide']);
  // a blank and its particle make the block 180px; two characters more would make it 216px, past the threshold, so the orphan is left (and reported)
  const left = wrapped('{p}をああ', 9);
  assert.deepEqual(left.lines, ['{p}を', 'ああ']);
  assert.ok(left.notes.includes('orphan-line'));
  assert.equal(left.box.split('x')[0], '204');
});

test('a short run of hiragana cut from its blank is reported (follower-split); one that stays with it, a particle, and a long run are not', () => {
  assert.deepEqual(wrapped('{p}なの？ご確認ください', 8).notes, ['follower-split']); // blank + な fill the line, の goes to the next
  assert.deepEqual(wrapped('{p}ですが、確認ください', 8).notes, ['follower-split']); // the fit rule binds the で, and す is left behind
  assert.deepEqual(wrapped('最近、{p}ですね。', 9).notes, []);
  assert.deepEqual(wrapped('{p}を確認する。', 9).notes, []);
  assert.deepEqual(wrapped('{p}しておきます。', 6).notes, []); // cut inside a run longer than three: the ADR records it, no advice
});

test('half-width katakana are measured (drawn at about half an em), not counted as full-width', () => {
  assert.equal(isFullWidth('ｱ'), false);
  assert.equal(isFullWidth('ﾞ'), false);
  assert.equal(comicAtomWidth('ｱ', () => 9), 9);
  assert.equal(isFullWidth('ア'), true);
  assert.equal(isFullWidth('Ａ'), true, 'a full-width Latin letter is a full em');
});

test('only the Latin runs of a template are measured (comicMeasure); full-width text and blanks never are', () => {
  const band = comic({version: 1, title: 'A', layout: '1x2', cast: {me: {name: '私'}}, panels: [
    {id: 'p1', stage: [{who: 'me', at: 'left', expression: 'neutral'}], dialogue: [{id: 'd1', who: 'me', kind: 'say', tpl: 'Slack で {x} を共有', slots: {x: {max: 3, prompt: '何を'}}}]},
    {id: 'p2', stage: [], dialogue: []},
  ]});
  assert.deepEqual(comicMeasure(band).map(t => t[0]), ['Slack', ' ', ' ', ' ']);
  assert.ok(comicMeasure(band).every(([, size, weight, font]) => size === 18 && weight === 400 && font === 'sans'));
});
