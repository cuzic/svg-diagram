// ADR 0074 U2 / D3: a character from an artist's material: the manifest, the cleaning of its fragments, the licence, the anchors, the ids.
import test from 'node:test';
import './helpers/strict-width.ts';
import assert from 'node:assert/strict';
import {characterSvg, loadCharacter, mapPoint, placement} from '../lib/comic/character.ts';
import {layoutComic} from '../lib/comic/layout.ts';
import {renderComicBand} from '../lib/comic/emit.ts';
import {tailAngle} from '../lib/comic/check.ts';
import {comic} from '../lib/dsl-pure.ts';
import type {CharacterManifest, ComicWorksheet} from '../lib/types/comic.ts';
import {ARTIST} from './helpers/comic-character.ts';

const widthOf = (a: string) => a.length * 9;
const sheet = (asset?: string, expression: 'neutral' | 'smile' | 'angry' = 'smile'): ComicWorksheet => ({version: 1, title: '図', layout: '1x2', cast: {me: {name: '私', face: {hue: 210}}, col: {name: '同僚', ...(asset ? {asset} : {face: {hue: 20}})}}, panels: [
  {id: 'p1', stage: [{who: 'me', at: 'left', expression: 'neutral'}, {who: 'col', at: 'right', expression}], dialogue: [{id: 'd1', who: 'col', kind: 'say', tpl: 'はい。'}, {id: 'd2', who: 'me', kind: 'say', tpl: 'いいえ。'}]},
  {id: 'p2', stage: [{who: 'col', at: 'left', expression: 'neutral'}], dialogue: []},
]});
const lay = (s: ComicWorksheet, characters?: Record<string, CharacterManifest>) => layoutComic(comic(s, characters ? {characters} : {}), 0, 0, 0, widthOf);
const withManifest = (patch: Partial<CharacterManifest> & Record<string, unknown>): CharacterManifest => ({...ARTIST, ...patch} as CharacterManifest);

test('loadCharacter keeps the box as it is (200 x 240, not made square) and the anchors in the box\'s own coordinates', () => {
  const c = loadCharacter(ARTIST);
  assert.deepEqual(c.box, [0, 0, 200, 240]);
  assert.deepEqual(c.anchors, {head: {cx: 100, cy: 90, r: 56}, mouth: [100, 112], hand: [150, 190]});
  assert.deepEqual(c.bubbleSides, ['top-left', 'top', 'top-right']);
  assert.deepEqual(Object.keys(c.expressions), ['neutral', 'smile']);
  assert.deepEqual(JSON.parse(JSON.stringify(c)), c, 'plain JSON: it travels in the band');
});

test('a manifest with no licence is refused when it is loaded (comic-license-missing), whichever part is missing', () => {
  for (const lic of [undefined, {}, {spdx: 'CC-BY-4.0', author: 'x'}, {spdx: '', author: 'x', url: 'u'}, {spdx: 'a', author: 'b', url: 3}]) {
    assert.throws(() => loadCharacter(withManifest({license: lic as never})), {message: /^comic-license-missing: 素材 "colleague-a"/});
  }
  assert.doesNotThrow(() => loadCharacter(ARTIST));
});

test('the shape is checked, naming the field: id, name, box, anchors, expressions', () => {
  assert.throws(() => loadCharacter(withManifest({id: 'a.b'})), /id が不正/);
  assert.throws(() => loadCharacter(withManifest({name: ''})), /name に表示名/);
  assert.throws(() => loadCharacter(withManifest({box: [0, 0, 0, 240] as never})), /box は \[x, y, width, height\]/);
  assert.throws(() => loadCharacter(withManifest({anchors: {head: {cx: 1, cy: 1, r: 0}, mouth: [0, 0]}})), /anchors\.head/);
  assert.throws(() => loadCharacter(withManifest({anchors: {head: {cx: 1, cy: 1, r: 5}, mouth: [0] as never}})), /anchors\.mouth/);
  assert.throws(() => loadCharacter(withManifest({bubbleSides: ['bottom'] as never})), /bubbleSides/);
  assert.throws(() => loadCharacter(withManifest({expressions: {smile: '<g/>'}})), /少なくとも neutral/);
  assert.throws(() => loadCharacter(withManifest({expressions: {neutral: '<circle r="1"/>', grin: '<g/>'} as never})), /表情 "grin"/);
});

test('the fragments are cleaned with the icon whitelist: no script, style, text, use, mask, filter, image, outside reference or named colour', () => {
  const frag = (inner: string) => withManifest({expressions: {neutral: inner}});
  assert.throws(() => loadCharacter(frag('<script>alert(1)</script>')), /<script> is not supported/);
  assert.throws(() => loadCharacter(frag('<style>circle{fill:red}</style>')), /<style> is not supported/);
  assert.throws(() => loadCharacter(frag('<text x="1" y="1">a</text>')), /<text> is not supported/);
  assert.throws(() => loadCharacter(frag('<use href="#a"/>')), /<use> is not supported/);
  assert.throws(() => loadCharacter(frag('<g mask="url(#m)"><circle r="1"/></g>')), /does not define/);
  assert.throws(() => loadCharacter(frag('<mask id="m"/>')), /<mask> is not supported/);
  assert.throws(() => loadCharacter(frag('<filter id="f"/>')), /<filter> is not supported/);
  assert.throws(() => loadCharacter(frag('<image href="http://example.com/a.png"/>')), /<image> is not supported/);
  assert.throws(() => loadCharacter(frag('<circle r="1" fill="white"/>')), /named colours/);
  assert.throws(() => loadCharacter(frag('<circle r="1" fill="url(http://example.com/a.svg#g)"/>')), /only url\(#id\)/);
  assert.throws(() => loadCharacter(frag('<circle r="1" onclick="x()"/>')), /not supported/);
  assert.throws(() => loadCharacter(frag('<circle r="1" fill="url(#missing)"/>')), /does not define/);
  assert.throws(() => loadCharacter(frag('<defs><linearGradient id="g"/><linearGradient id="g"/></defs><circle r="1" fill="url(#g)"/>')), /SVG の id が重複/);
  assert.doesNotThrow(() => loadCharacter(frag('<circle cx="1" cy="1" r="1" fill="#ffddbb" stroke="#222222"/>')));
});

test('the figure is placed so that the box\'s head circle is the stage head, and every anchor follows (a 200 x 240 box does not shift anything)', () => {
  const c = loadCharacter(ARTIST);
  const head = {cx: 300, cy: 200, r: 36};
  const {scale, x, y} = placement(c, head);
  assert.equal(scale, 36 / 56);
  assert.equal(Number(scale.toFixed(3)), 0.643);
  assert.deepEqual(mapPoint(c, head, [100, 90]), [300, 200], 'the head centre');
  assert.deepEqual(mapPoint(c, head, [100, 112]), [300, 214.1], 'the mouth, 22px below in the box = 14.1px on the panel');
  assert.deepEqual(mapPoint(c, head, [150, 190]), [332.1, 264.3], 'the hand');
  assert.ok(Math.abs(x - (300 - 100 * 36 / 56)) < 0.1 && Math.abs(y - (200 - 90 * 36 / 56)) < 0.1);
  const svg = characterSvg(c, 'smile', head, 'x-')!;
  assert.match(svg, /^<svg data-character="colleague-a" x="[\d.]+" y="[\d.]+" width="128.6" height="154.3" viewBox="0 0 200 240" preserveAspectRatio="none" overflow="hidden">/);
  assert.ok(!svg.includes('transform='), 'no transform: the nested viewBox does the placing');
  // the box's head centre lands on the stage head: x + 100 * (128.6 / 200) = 300, y + 90 * (154.3 / 240) = 200
  const at = /x="([\d.]+)" y="([\d.]+)"/.exec(svg)!;
  assert.ok(Math.abs(Number(at[1]) + 100 * 0.643 - 300) < 0.2 && Math.abs(Number(at[2]) + 90 * 0.643 - 200) < 0.2);
  assert.equal(characterSvg(c, 'angry', head, 'x-'), undefined, 'an expression the character does not have');
});

test('moving the viewBox origin and its anchors together leaves the placed viewport and points in the same place', () => {
  const head = {cx: 300, cy: 200, r: 36};
  const original = loadCharacter(ARTIST);
  const shifted = loadCharacter(withManifest({
    box: [10000, -20000, 200, 240],
    anchors: {head: {cx: 10100, cy: -19910, r: 56}, mouth: [10100, -19888]},
  }));
  const viewport = (c: typeof original) => /^<svg [^>]*? (x="[^"]+" y="[^"]+" width="[^"]+" height="[^"]+")/.exec(characterSvg(c, 'neutral', head, 'x-') ?? '')?.[1];
  assert.ok(viewport(original));
  assert.equal(viewport(shifted), viewport(original));
  assert.deepEqual(mapPoint(shifted, head, shifted.anchors.mouth), [300, 214.1]);
});

test('the layout of a panel is the same with an artist\'s character as with the built-in face: the heads, the bubbles and the stacking come from the anchors alone', () => {
  const face = lay(sheet());
  const art = lay(sheet('colleague-a'), {'colleague-a': ARTIST});
  assert.deepEqual(art.findings, []);
  const strip = (l: typeof face) => ({panels: l.panels.map(p => ({...p, heads: p.heads.map(h => [h.cx, h.cy, h.r])})), bubbles: l.bubbles.map(b => [b.id, b.x, b.y, b.w, b.h])});
  assert.deepEqual(strip(art), strip(face));
  // the tail of the character's bubble aims at the character's own mouth (mapped), not at the built-in one
  const head = art.panels[0]!.heads[1]!;
  assert.deepEqual(head.mouth, [332, 292 + 14.1]);
  assert.deepEqual(head.look, {kind: 'asset', asset: 'colleague-a'});
  assert.deepEqual(head.hand, [332 + 50 * 36 / 56, 292 + 100 * 36 / 56].map(v => Math.round(v * 10) / 10));
  const b = art.bubbles[0]!;
  assert.ok(b.tail && tailAngle(b.tail, head.mouth) <= 0.17);
});

test('a missing asset or a missing expression is a problem (comic-asset-missing), and the built-in face is drawn in its place', () => {
  const unknown = lay(sheet('nobody'));
  assert.deepEqual(unknown.findings.map(f => [f.rule, f.where, f.severity]), [['comic-asset-missing', 'p1.col', 'problem'], ['comic-asset-missing', 'p2.col', 'problem']]);
  assert.match(unknown.findings[0]!.message, /"nobody"/);
  assert.deepEqual(unknown.panels[0]!.heads[1]!.look.kind, 'face');
  const noExpression = lay(sheet('colleague-a', 'angry'), {'colleague-a': ARTIST});
  assert.deepEqual(noExpression.findings.map(f => [f.rule, f.where]), [['comic-asset-missing', 'p1.col']]);
  assert.match(noExpression.findings[0]!.message, /表情 "angry" がありません/);
  assert.deepEqual(noExpression.panels[0]!.heads[1]!.look.kind, 'face');
  assert.deepEqual(noExpression.panels[1]!.heads[0]!.look, {kind: 'asset', asset: 'colleague-a'}, 'the other panel still has its character');
  const inherited = lay(sheet('constructor'), {'colleague-a': ARTIST});
  assert.deepEqual(inherited.findings.map(f => f.rule), ['comic-asset-missing', 'comic-asset-missing']);
});

test('comic() loads the characters it is given: a licence-less one throws, and a character is keyed by its id', () => {
  assert.throws(() => comic(sheet('colleague-a'), {characters: {'colleague-a': withManifest({license: undefined as never})}}), /comic-license-missing/);
  assert.throws(() => comic(sheet('colleague-a'), {characters: {other: ARTIST}}), /キー "other" を素材の id "colleague-a" に/);
  const band = comic(sheet('colleague-a'), {characters: {'colleague-a': ARTIST}});
  assert.deepEqual(Object.keys(band.characters!), ['colleague-a']);
  assert.ok(!('characters' in comic(sheet())), 'no characters, no field');
});

test('the same character twice in one SVG never shares an id: gradients and their references are rewritten per figure; the figure is cut by the panel', () => {
  const l = lay(sheet('colleague-a', 'smile'), {'colleague-a': ARTIST});
  const svg = renderComicBand(l);
  const ids = [...svg.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]!);
  assert.equal(new Set(ids).size, ids.length, `ids are unique: ${ids.join(', ')}`);
  assert.ok(ids.includes('ch-p1-col-cloth') && ids.includes('ch-p2-col-cloth'), 'the gradient of each figure has its own id');
  assert.ok(svg.includes('fill="url(#ch-p1-col-cloth)"') && svg.includes('fill="url(#ch-p2-col-cloth)"'));
  assert.ok(!svg.includes('url(#cloth)'), 'no reference to the manifest\'s own id is left');
  assert.ok(svg.includes('clip-path="url(#pc-p1)"') && svg.includes('<clipPath id="pc-p1">'), 'below the chest the frame cuts the figure');
  for (const ref of svg.matchAll(/url\(#([^)]+)\)/g)) assert.ok(ids.includes(ref[1]!), `${ref[1]} is defined`);
  assert.ok(!/<(text|use|filter|style|script|image)[ >]/.test(svg.replace(/<text [^>]*>[^<]*<\/text>/g, '')), 'a figure holds shapes only');
});

test('the same data and the same characters draw the same SVG', () => {
  const draw = () => renderComicBand(lay(sheet('colleague-a'), {'colleague-a': ARTIST}));
  assert.equal(draw(), draw());
});
