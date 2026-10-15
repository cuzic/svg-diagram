import test from 'node:test';
import assert from 'node:assert/strict';
import {setWrapMode, wrapText, type WrapMode} from '../lib/wrap.ts';
import {measureNode} from '../lib/tree.ts';
import {ROLES} from '../lib/tokens.ts';

// Fixed-size atoms: 10px a character, whatever the font.
const opts = (maxWidth: number) => ({maxWidth, atomWidth: (a: string) => 10 * [...a].length});
const withMode = <T>(mode: WrapMode, f: () => T): T => { const prev = setWrapMode(mode); try { return f(); } finally { setWrapMode(prev); } };
const isHira = (c: string): boolean => /^[ぁ-ゟ]$/.test(c);
const SENTENCES = ['現場が協力せず、形だけ使う', '稼働率で評価されるため仕掛りが増える', 'PoCは成功するが指標が動かない'];

// A break is legal when the next line starts with a non-hiragana, or the line ends with 、/。
const legalBreaks = (lines: string[]): boolean => lines.slice(0, -1).every((l, i) => '、。'.includes([...l].at(-1)!) || !isHira([...lines[i + 1]][0]));
// The units of the rule: cut after a hiragana that a non-hiragana follows, and after 、/。
const unitsOf = (s: string): string[] => s.split(/(?<=[ぁ-ゟ])(?=[^ぁ-ゟ])|(?<=[、。])/);

test('bunsetsu: the three requested sentences break only at a clause boundary', () => {
  for (const s of SENTENCES) for (const w of [40, 60, 80, 100, 130, 160, 250]) {
    if (Math.max(...unitsOf(s).map(u => u.length)) * 10 > w) continue; // a unit wider than the line breaks per character
    const lines = withMode('bunsetsu', () => wrapText(s, opts(w)));
    assert.equal(lines.join(''), s);
    assert.ok(legalBreaks(lines), `${s} @${w}: ${lines.join(' / ')}`);
  }
});

test('bunsetsu: hiragana stick to the character before them', () => {
  assert.deepEqual(withMode('bunsetsu', () => wrapText('稼働率で評価されるため仕掛りが増える', opts(120))), ['稼働率で評価されるため', '仕掛りが増える']);
  assert.deepEqual(withMode('bunsetsu', () => wrapText('現場が協力せず、形だけ使う', opts(60))), ['現場が', '協力せず、', '形だけ使う']);
});

test('bunsetsu: a unit wider than a line breaks per character', () => {
  const lines = withMode('bunsetsu', () => wrapText('評価されるため', opts(40)));
  assert.equal(lines.join(''), '評価されるため');
  assert.ok(lines.every(l => [...l].length <= 4));
});

test('bunsetsu: kinsoku still holds', () => {
  for (const w of [30, 40, 50, 70]) {
    const lines = withMode('bunsetsu', () => wrapText('協力せず、形だけ使う。次へ進む', opts(w)));
    assert.ok(lines.slice(1).every(l => !'、。'.includes([...l][0])), lines.join(' / '));
  }
});

test("'phrase' and 'char' are what they were", () => {
  assert.deepEqual(withMode('phrase', () => wrapText('作業アプリ', opts(40))), ['作業', 'アプリ']);
  assert.deepEqual(withMode('phrase', () => wrapText('これは独自表現', opts(50))), ['これは', '独自表現']);
  assert.deepEqual(withMode('char', () => wrapText('開発アプリ', opts(40))), ['開発ア', 'プリ']);
  // hiragana are not bound in 'phrase': it breaks inside 協力せず
  const s = '現場が協力せず、形だけ使う';
  assert.notDeepEqual(withMode('phrase', () => wrapText(s, opts(60))), withMode('bunsetsu', () => wrapText(s, opts(60))));
});

test('property: random strings keep their characters and respect kinsoku in bunsetsu mode', () => {
  let seed = 12345;
  const rnd = (n: number): number => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return (seed >> 8) % n; };
  const pool = [...'あいうえおかきくけこ協力評価稼働率アプリケPoC12、。'];
  for (let t = 0; t < 300; t++) {
    const s = Array.from({length: 5 + rnd(25)}, () => pool[rnd(pool.length)]).join('');
    const w = 30 + rnd(12) * 10;
    const lines = withMode('bunsetsu', () => wrapText(s, opts(w)));
    assert.equal(lines.join(''), s);
    assert.ok(lines.slice(1).every(l => !'、。'.includes([...l][0])), `${s} @${w}: ${lines.join(' / ')}`);
  }
});

test('measureNode: bunsetsu widens a box to its longest unit (capped), phrase and roomy boxes are untouched', () => {
  const widthOf = (a: string): number => 10 * [...a].length;
  const label = '稼働率で評価されるため仕掛りが増える'; // longest unit 評価されるため: 70px
  const maxW = 90; // inner width is under the unit, and 1.5 x maxW reaches over it
  const run = (mode: WrapMode, w: number) => withMode(mode, () => measureNode(label, undefined, w, widthOf, ROLES));
  const phrase = run('phrase', maxW), bun = run('bunsetsu', maxW);
  assert.ok(bun.w > phrase.w);
  assert.ok(bun.w <= 1.5 * maxW);
  assert.ok(bun.label.some(l => l.includes('評価されるため')), bun.label.join('/'));
  assert.equal(bun.label.join(''), label);
  assert.equal(run('bunsetsu', 600).w, run('phrase', 600).w);
  assert.deepEqual(run('bunsetsu', 600).label, run('phrase', 600).label);
  // a unit over the cap breaks per character: the box stays within 1.5 x maxW
  assert.ok(withMode('bunsetsu', () => measureNode('評価されるためのしくみを作り直す', undefined, 100, widthOf, ROLES)).w <= 150);
});
