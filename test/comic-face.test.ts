// ADR 0074 U2 / D3: the built-in face: 8 expressions, 2 hair styles, a hue; and ADR 0076 A2: every boundary between two fills inside a figure is a three-layer line.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {faceSvg, clothesColor, hairColor} from '../lib/comic/face.ts';
import {EXPRESSIONS} from '../lib/comic/character.ts';
import {COLOR, rgb} from '../lib/comic/constants.ts';
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
const GOLDEN: Record<string, string> = {neutral: '986018b80c2b', smile: '5503fb144de7', laugh: '8e9c93ecae05', surprise: '6dd259b8b387', worry: 'bfb3df66f828', angry: '9274ff4d6a2c', think: '2331fbdecdd8', sad: '4fbdd85bccd7', long: '71fe6c40a702'};
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

test('angry lowers the inner ends of the brows, while worry and sad raise them', () => {
  for (const [expression, direction] of [['angry', 1], ['worry', -1], ['sad', -1]] as const) {
    const brows = strokes(fig(expression)).flatMap(({d}) => {
      const line = /^M(-?[\d.]+) (-?[\d.]+)L(-?[\d.]+) (-?[\d.]+)$/.exec(d);
      return line ? [[Number(line[1]), Number(line[2]), Number(line[3]), Number(line[4])] as const] : [];
    });
    assert.equal(brows.length, 2, expression);
    const sides = new Set<number>();
    for (const [x1, y1, x2, y2] of brows) {
      const side = Math.sign((x1 + x2) / 2 - 100);
      sides.add(side);
      const innerMinusOuter = Math.abs(x1 - 100) < Math.abs(x2 - 100) ? y1 - y2 : y2 - y1;
      assert.ok(direction * innerMinusOuter > 0, `${expression}, side ${side}: inner y minus outer y is ${innerMinusOuter}`);
    }
    assert.deepEqual(sides, new Set([-1, 1]));
  }
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

test('every hue, hair style and expression keeps the three-layer boundaries', () => {
  const shape = (svg: string) => svg.replace(/hsl\([^)]*\)/g, 'hsl').replace(/data-face="[a-z]+"/, '');
  const boundaries = (svg: string) => {
    const lines = strokes(svg);
    return lines.flatMap((line, i) => line.stroke === COLOR.paper ? [line, lines[i + 1]] : []);
  };
  for (const hair of ['short', 'long'] as const) {
    const base = boundaries(fig('neutral', 0, hair));
    assert.equal(base.length, hair === 'long' ? 8 : 4);
    for (const expression of EXPRESSIONS) {
      const svg = fig(expression, 0, hair);
      const expected = shape(svg);
      assert.deepEqual(boundaries(svg), base, `${expression} ${hair}`);
      assert.doesNotMatch(svg, /<(text|use|filter|style|script|image)[ >]/);
      for (let hue = 1; hue < 360; hue++) assert.equal(shape(fig(expression, hue, hair)), expected, `${expression} ${hair} ${hue}`);
    }
  }
});

test('the colours: skin is the token U1 used, the hair and the clothes come from the hue', () => {
  assert.equal(rgb('#a10BfF'), 'rgb(161,11,255)');
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

test('a person with no face gets a hue from the place in the cast (the same in every panel); a face keeps its own', () => {
  const l = lay(sheet({a: {name: 'A'}, b: {name: 'B'}, c: {name: 'C', face: {hue: 99, hair: 'long'}}}));
  const looks = l.panels[0]!.heads.map(h => h.look);
  assert.deepEqual(looks[0], {kind: 'face', hue: 210, hair: 'short'});
  assert.ok(looks[1]?.kind === 'face' && looks[1].hue !== 210);
  assert.deepEqual(looks[2], {kind: 'face', hue: 99, hair: 'long'});
  assert.deepEqual(l.panels[1]!.heads[0]!.look, looks[1], 'B looks the same in the second panel');
});

test('adjacent default hues and the first six cast members are at least 30 degrees apart', () => {
  const people = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  const cast = Object.fromEntries(people.map(who => [who, {name: who}]));
  const hues = people.map(who => {
    const s = sheet(cast);
    s.panels[0]!.stage = [{who, at: 'left', expression: 'neutral'}];
    const look = lay(s).panels[0]!.heads[0]!.look;
    assert.equal(look.kind, 'face');
    return look.hue;
  });
  const distance = (a: number, b: number) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));
  for (const [i, hue] of hues.entries()) {
    const others = i < 6 ? hues.slice(0, i) : hues.slice(i - 1, i);
    for (const other of others) assert.ok(distance(hue, other) >= 30, `${hue} is too close to ${other}`);
  }
});

test('comic() checks the face: hue is a whole number from 0 to 359, hair is short or long', () => {
  for (const hue of [-1, 360, 1.5, Number.NaN]) assert.throws(() => comic(sheet({a: {name: 'A', face: {hue}}, b: {name: 'B'}, c: {name: 'C'}})), /face\.hue/);
  assert.throws(() => comic(sheet({a: {name: 'A', face: null as never}, b: {name: 'B'}, c: {name: 'C'}})), /face\.hue/);
  assert.throws(() => comic(sheet({a: {name: 'A', face: {hue: 1, hair: 'bob' as 'short'}}, b: {name: 'B'}, c: {name: 'C'}})), /face\.hair/);
  assert.doesNotThrow(() => comic(sheet({a: {name: 'A', face: {hue: 359, hair: 'long'}}, b: {name: 'B'}, c: {name: 'C'}})));
});

test('the head of the built-in face is the stage head and its mouth anchor is where U1 put it', () => {
  const h = lay(sheet({a: {name: 'A'}, b: {name: 'B'}, c: {name: 'C'}})).panels[0]!.heads[0]!;
  assert.deepEqual([h.r, h.mouth], [36, [h.cx, h.cy + 15.1]]);
  assert.equal(h.hand, undefined);
});
