// ADR 0031 §4: properties of the pure functions of the core, over cases a seeded generator makes (test/helpers/rng.ts). A failure names its seed.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {forAll, type Rng} from './helpers/rng.ts';
import {splitAtoms} from '../lib/atoms.ts';
import {wrapAtoms, type WrapMode} from '../lib/wrap.ts';
import {wcagRatio, relativeLuminance, recolor, NO_TONES, toneEnv, checkTones, mergeTones, LIGHT_COLORS, DARK_COLORS, type ToneOverrides} from '../lib/tokens.ts';
import {boxOf, unionBox, transformBox, type Box} from '../lib/svg-geom.ts';
import {IDENTITY, multiply} from '../lib/svg-dom.ts';

const PIECES = ['在庫', 'を', '確認', 'する', 'アプリケーション', 'ダッシュボード', 'Inventory', 'Total:', '1,240', ' ', ' ', '、', '。', '「', '」', 'x', 'M8', '😀', '👨‍👩‍👧', 'ー', 'ッ', 'です', '。\n'];
const text = (r: Rng): string => Array.from({length: r.int(0, 24)}, () => r.pick(PIECES)).join('');
const hex = (r: Rng): string => '#' + Array.from({length: 6}, () => r.pick([...'0123456789abcdef'])).join('');
const squash = (s: string): string => s.replace(/\s+/g, '');

test('splitAtoms: the atoms put back together are the text', () => {
  forAll(300, r => { const t = text(r); assert.equal(splitAtoms(t).join(''), t); });
});

test('wrapAtoms: every mode keeps the characters in order, makes no empty line for a text, and a very wide line holds it all', () => {
  const width = (a: string): number => [...a].length * 10;
  for (const mode of ['phrase', 'char', 'bunsetsu'] as WrapMode[]) forAll(200, r => {
    const t = text(r).replace(/\n/g, ' '), atoms = splitAtoms(t), max = r.int(1, 12) * 10;
    const lines = wrapAtoms(atoms, {maxWidth: max, atomWidth: width, mode});
    assert.equal(squash(lines.join('')), squash(t), `${mode}: characters kept in order`);
    if (squash(t)) assert.ok(lines.every(l => l.trim() !== '' || lines.length === 1), `${mode}: no empty line in ${JSON.stringify(lines)}`);
    const wide = wrapAtoms(atoms, {maxWidth: 1e9, atomWidth: width, mode});
    assert.equal(wide.length <= 1, true, `${mode}: one line when everything fits`);
    assert.deepEqual(wrapAtoms(atoms, {maxWidth: max, atomWidth: width, mode}), lines, `${mode}: same input, same lines`);
  });
});

test('wcagRatio: symmetric, between 1 and 21, 1 against itself, and relativeLuminance is monotone on grays', () => {
  forAll(300, r => {
    const a = hex(r), b = hex(r), ratio = wcagRatio(a, b);
    assert.equal(ratio, wcagRatio(b, a));
    assert.ok(ratio >= 1 - 1e-9 && ratio <= 21 + 1e-9, `${a} ${b}: ${ratio}`);
    assert.ok(Math.abs(wcagRatio(a, a) - 1) < 1e-9);
    const g1 = r.int(0, 255), g2 = r.int(0, 255), gray = (g: number) => '#' + g.toString(16).padStart(2, '0').repeat(3);
    assert.equal(g1 <= g2, relativeLuminance(gray(g1)) <= relativeLuminance(gray(g2)));
  });
  assert.ok(Math.abs(wcagRatio('#000000', '#ffffff') - 21) < 1e-9);
});

test('recolor: the built-in dark set is idempotent, light is the identity, and colours that are no token stay', () => {
  const lights = [...LIGHT_COLORS], darks = [...DARK_COLORS];
  forAll(200, r => {
    const colours = Array.from({length: r.int(1, 8)}, () => r.pick([...lights, ...darks, hex(r)]));
    const svg = `<svg xmlns="http://www.w3.org/2000/svg">${colours.map((c, i) => `<rect id="r${i}" fill="${c}" stroke="${r.pick(colours)}"/>`).join('')}<text>${colours.join(' ')}</text></svg>`;
    const once = recolor(NO_TONES, svg, 'dark');
    assert.equal(recolor(NO_TONES, once, 'dark'), once, 'dark twice is dark once');
    assert.equal(recolor(NO_TONES, svg, 'light'), svg);
    assert.equal(recolor(NO_TONES, svg, undefined), svg);
    assert.ok(once.includes(`<text>${colours.join(' ')}</text>`), 'text content is not a colour-bearing place');
  });
});

test('tone overrides: a light colour with a dark pair becomes its dark colour, in every colour-bearing place', () => {
  forAll(150, r => {
    const light = hex(r), dark = hex(r);
    if (LIGHT_COLORS.has(light) || DARK_COLORS.has(light) || light === dark) return;
    const env = toneEnv(checkTones({accent: {fill: light, dark: {fill: dark}}}, 'tones'));
    const out = recolor(env, `<rect fill="${light}" stroke="${light}"/>`, 'dark');
    assert.equal(out, `<rect fill="${dark}" stroke="${dark}"/>`);
    assert.equal(recolor(env, `<rect fill="${light}"/>`, 'light'), `<rect fill="${light}"/>`);
  });
});

test('checkTones / mergeTones: normalising twice is the same as once, and undefined is the unit of the merge', () => {
  forAll(200, r => {
    const names = ['plain', 'accent', 'danger', 'muted', 'new', 'changed', 'removed'] as const;
    const ov: Record<string, unknown> = {};
    for (const n of names) if (r.bool(0.4)) {
      const o: Record<string, unknown> = {};
      for (const k of ['fill', 'stroke', 'text', 'ink']) if (r.bool(0.4)) { const c = hex(r); if (!LIGHT_COLORS.has(c)) o[k] = r.bool() ? c.toUpperCase().replace('#', '#') : c; }
      ov[n] = o;
    }
    const once = checkTones(ov, 'tones');
    assert.deepEqual(checkTones(once, 'tones'), once);
    assert.equal(mergeTones(undefined, once), once);
    assert.equal(mergeTones(once, undefined), once);
    assert.deepEqual(mergeTones(once, once), once, 'merging a set with itself changes nothing');
  });
});

test('boxes: the union holds every box, and an identity transform changes nothing', () => {
  forAll(200, r => {
    const boxes: Box[] = Array.from({length: r.int(1, 6)}, () => ({x: r.int(-50, 200), y: r.int(-50, 200), w: r.int(0, 150), h: r.int(0, 150)}));
    const u = unionBox(boxes)!;
    for (const b of boxes) assert.ok(u.x <= b.x && u.y <= b.y && u.x + u.w >= b.x + b.w && u.y + u.h >= b.y + b.h);
    assert.deepEqual(transformBox(u, IDENTITY), u);
    assert.deepEqual(multiply(IDENTITY, IDENTITY), IDENTITY);
    assert.equal(unionBox([null, null]), null);
    assert.deepEqual(boxOf([[1, 2], [4, 6]]), {x: 1, y: 2, w: 3, h: 4});
  });
});
