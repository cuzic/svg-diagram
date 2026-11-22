// ADR 0074 U2 / D3: the built-in face: 8 expressions, 2 hair styles, a hue; and ADR 0076 A2: every boundary between two fills inside a figure is a three-layer line.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {faceSvg, clothesColor, hairColor} from '../lib/comic/face.ts';
import {EXPRESSIONS} from '../lib/comic/character.ts';
import {COLOR} from '../lib/comic/constants.ts';
import {layoutComic} from '../lib/comic/layout.ts';
import {comic} from '../lib/dsl-pure.ts';
import {PALETTE, wcagRatio} from '../lib/tokens.ts';
import type {ComicExpression, ComicWorksheet} from '../lib/types/comic.ts';

const fig = (expression: ComicExpression, hue = 210, hair: 'short' | 'long' = 'short') => faceSvg({cx: 100, cy: 200, expression}, hue, hair, 276, 'ch-p1-me');
const hash = (s: string) => createHash('sha256').update(s).digest('hex').slice(0, 12);

test('8 expressions are drawn, each different, and the same input is the same SVG', () => {
  assert.deepEqual([...EXPRESSIONS], ['neutral', 'smile', 'laugh', 'surprise', 'worry', 'angry', 'think', 'sad']);
  const all = EXPRESSIONS.map(e => fig(e));
  assert.equal(new Set(all).size, 8);
  assert.deepEqual(EXPRESSIONS.map(e => fig(e)), all);
  for (const [i, e] of EXPRESSIONS.entries()) assert.ok(all[i]!.startsWith(`<g data-face="${e}">`));
});

// A golden for each expression (a hash of the SVG of the figure; short hair, hue 210), and one for long hair. A change to a face shows here and is looked at by a person.
const GOLDEN: Record<string, string> = {neutral: '986018b80c2b', smile: '5503fb144de7', laugh: '8e9c93ecae05', surprise: '6dd259b8b387', worry: 'bfe1058e5ef4', angry: '0351338e7471', think: '2331fbdecdd8', sad: 'd5a8943aaf09', long: '71fe6c40a702'};
test('golden: each expression, and long hair', () => {
  const got = {...Object.fromEntries(EXPRESSIONS.map(e => [e, hash(fig(e))])), long: hash(fig('smile', 40, 'long'))};
  assert.deepEqual(got, GOLDEN);
});

/** The strokes of a figure in order: [d, stroke, width] of each <path>/<circle> that has a stroke. */
const strokes = (svg: string) => [...svg.matchAll(/<(path|circle)\b([^>]*?)\/?>/g)].flatMap(m => {
  const a = m[2]!, stroke = /stroke="([^"]+)"/.exec(a)?.[1], w = Number(/stroke-width="([\d.]+)"/.exec(a)?.[1]);
  const geometry = /\bd="([^"]+)"/.exec(a)?.[1] ?? /cx="([^"]+)" cy="([^"]+)" r="([^"]+)"/.exec(a)?.slice(1).join(',');
  return stroke === undefined || geometry === undefined || !a.includes('fill="none"') ? [] : [{d: geometry, stroke, w}];
});

test('ADR 0076 A2: every inner boundary is a three-layer line (a paper keyline, the ink line, a paper keyline); the outer edge is the ink line alone', () => {
  for (const [hair, pairs] of [['short', 2], ['long', 4]] as const) {
    const s = strokes(fig('smile', 210, hair));
    const keyed: number[] = [];
    s.forEach((st, i) => { if (st.stroke === COLOR.paper) keyed.push(i); });
    assert.equal(keyed.length, pairs, `${hair}: head on clothes, the hairline${hair === 'long' ? ', two locks' : ''}`);
    for (const i of keyed) {
      const key = s[i]!, line = s[i + 1]!;
      assert.equal(line.stroke, COLOR.ink, 'the ink line follows its keyline');
      assert.equal(line.d, key.d, 'on the same path');
      assert.equal(line.w, 2.5);
      assert.equal((key.w - line.w) / 2, 1.5, 'a keyline of 1.5px on each side');
    }
    // the outer edges (the clothes, the head, the hair) have an ink line and no keyline of their own
    for (const st of s) if (st.stroke === COLOR.ink && st.w === 2.5) assert.ok(st.d.length > 0);
    const outer = s.filter((st, i) => st.stroke === COLOR.ink && !keyed.includes(i - 1));
    assert.ok(outer.length >= 3, 'the clothes, the head, the hair have their own outer line');
  }
});

test('the ink and the paper are far apart (the keyline makes every boundary readable whatever the two fills are): 15:1 and more', () => {
  assert.ok(wcagRatio(PALETTE.text, PALETTE.bg) >= 15);
});

test('every hue and both hair styles keep the same structure (the boundaries do not depend on the colours)', () => {
  const shape = (svg: string) => svg.replace(/hsl\([^)]*\)/g, 'hsl').replace(/data-face="[a-z]+"/, '');
  const base = shape(fig('neutral', 0));
  for (let hue = 0; hue < 360; hue += 30) assert.equal(shape(fig('neutral', hue)), base);
  for (const e of EXPRESSIONS) for (const hair of ['short', 'long'] as const) {
    const svg = fig(e, 123, hair);
    assert.equal(strokes(svg).filter(s => s.stroke === COLOR.paper).length, hair === 'long' ? 4 : 2, `${e} ${hair}`);
    assert.ok(!/<(text|use|filter|style|script|image)[ >]/.test(svg));
  }
});

test('the colours: skin is the token U1 used, the hair and the clothes come from the hue', () => {
  assert.equal(COLOR.skin, 'rgb(241,227,211)');
  const s = fig('neutral', 210);
  assert.ok(s.includes(`fill="${COLOR.skin}"`) && s.includes(`fill="${hairColor(210)}"`) && s.includes(`fill="${clothesColor(210)}"`));
  assert.equal(hairColor(210), 'hsl(210 35% 28%)');
  assert.equal(clothesColor(210), 'hsl(210 45% 62%)');
});

const sheet = (cast: ComicWorksheet['cast']): ComicWorksheet => ({version: 1, title: '図', layout: '1x2', cast, panels: [
  {id: 'p1', stage: [{who: 'a', at: 'left', expression: 'smile'}, {who: 'b', at: 'center', expression: 'sad'}, {who: 'c', at: 'right', expression: 'neutral'}], dialogue: []},
  {id: 'p2', stage: [{who: 'b', at: 'left', expression: 'angry'}], dialogue: []},
]});
const lay = (s: ComicWorksheet) => layoutComic(comic(s), 0, 0, 0, a => a.length * 9);

test('a person with no face gets a hue from the place in the cast (the same in every panel, different for each of the first five); a face keeps its own', () => {
  const l = lay(sheet({a: {name: 'A'}, b: {name: 'B'}, c: {name: 'C', face: {hue: 99, hair: 'long'}}}));
  const looks = l.panels[0]!.heads.map(h => h.look);
  assert.deepEqual(looks, [{kind: 'face', hue: 210, hair: 'short'}, {kind: 'face', hue: 280, hair: 'short'}, {kind: 'face', hue: 99, hair: 'long'}]);
  assert.deepEqual(l.panels[1]!.heads[0]!.look, looks[1], 'B looks the same in the second panel');
  assert.equal(new Set([0, 1, 2, 3, 4].map(i => (210 + 70 * i) % 360)).size, 5);
});

test('comic() checks the face: hue is a whole number from 0 to 359, hair is short or long', () => {
  for (const hue of [-1, 360, 1.5, Number.NaN]) assert.throws(() => comic(sheet({a: {name: 'A', face: {hue}}, b: {name: 'B'}, c: {name: 'C'}})), /face\.hue/);
  assert.throws(() => comic(sheet({a: {name: 'A', face: {hue: 1, hair: 'bob' as 'short'}}, b: {name: 'B'}, c: {name: 'C'}})), /face\.hair/);
  assert.doesNotThrow(() => comic(sheet({a: {name: 'A', face: {hue: 359, hair: 'long'}}, b: {name: 'B'}, c: {name: 'C'}})));
});

test('the head of the built-in face is the stage head and its mouth anchor is where U1 put it', () => {
  const h = lay(sheet({a: {name: 'A'}, b: {name: 'B'}, c: {name: 'C'}})).panels[0]!.heads[0]!;
  assert.deepEqual([h.r, h.mouth], [36, [h.cx, h.cy + 15.1]]);
  assert.equal(h.hand, undefined);
});
