import test from 'node:test';
import './helpers/strict-width.ts'; // a text the layout did not register for measuring throws instead of measuring 0 wide
import assert from 'node:assert/strict';
import {wordart} from '../lib/dsl.ts';
import {GLOW_RINGS, PRESETS, gradientId, gradientOf, gradientSteps, inkReach, legibilityProblem, minRim, paintLayers, resolveLook} from '../lib/wordart.ts';
import {paintOf} from '../lib/tokens.ts';
import {place} from './helpers/wordart.ts';

test('looks are values: a preset, then each option on top of it', () => {
  assert.deepEqual(resolveLook({}, 40).outlines, []);
  assert.equal(resolveLook({}, 40).weight, 700);
  assert.equal(resolveLook({style: 'plain'}, 40).weight, 400);
  const o = resolveLook({style: 'outline'}, 50);
  assert.deepEqual(o.outlines, [{tone: 'text', width: 3}]);
  assert.equal(o.fill, 'bg');
  const s = resolveLook({style: 'sticker', outline: false, shadow: {tone: 'danger', dx: 5, dy: 6}, tone: 'text', weight: 'normal'}, 50);
  assert.deepEqual(s.outlines, []);
  assert.deepEqual(s.shadow, {tone: 'danger', dx: 5, dy: 6});
  assert.equal(s.weight, 400);
  assert.deepEqual(resolveLook({outline: [{tone: 'bg', width: 2}, {tone: 'text', width: 4}]}, 50).outlines, [{tone: 'bg', width: 2}, {tone: 'text', width: 4}]);
  assert.equal(resolveLook({outline: true}, 50).outlines.length, 1);
});

test('the constructor says what is wrong', () => {
  assert.throws(() => wordart(''), /non-empty/);
  assert.throws(() => wordart('x', {style: 'neon' as never}), /style must be one of/);
  assert.throws(() => wordart('x', {tone: 'pink' as never}), /must be a tone/);
  assert.throws(() => wordart('x', {size: 10}), /at least 14/);
  assert.throws(() => wordart('x', {writing: 'diagonal' as never}), /writing/);
  assert.throws(() => wordart('x', {outline: {width: 0}}), /outline width/);
  assert.throws(() => wordart('x', {shadow: {tone: 'red' as never}}), /shadow tone/);
});

test('legibility: a letter must read on the page, or by its rim, or on its plate', () => {
  const day = 'blue' as const;
  assert.equal(legibilityProblem(resolveLook({}, 40), day), null);
  assert.match(legibilityProblem(resolveLook({tone: 'bg'}, 40), day)!, /barely differ from the page/);
  assert.equal(legibilityProblem(resolveLook({style: 'outline'}, 40), day), null, 'a white letter with a dark rim reads');
  assert.match(legibilityProblem(resolveLook({tone: 'bg', outline: [{tone: 'soft'}]}, 40), day)!, /outline/);
  assert.match(legibilityProblem(resolveLook({tone: 'bg', outline: [{tone: 'text'}, {tone: 'bg'}]}, 40), day)!, /outline \(bg\) barely differs/);
  assert.equal(legibilityProblem(resolveLook({tone: 'bg', plate: 'accent'}, 40), day), null);
  assert.match(legibilityProblem(resolveLook({tone: 'accent', plate: 'accent'}, 40), day)!, /plate/);
});

test('new looks resolve from presets and options', () => {
  const g = resolveLook({style: 'gradient'}, 50);
  assert.deepEqual(g.gradient, {from: 'accent', to: 'text', angle: 90});
  assert.equal(resolveLook({style: 'gradient', tone: 'danger'}, 50).gradient, undefined, 'a tone replaces the preset gradient');
  assert.ok(resolveLook({style: 'glow'}, 50).glow!.radius > 0);
  assert.ok(resolveLook({style: '3d'}, 50).extrude!.dx > 0);
  assert.ok(resolveLook({style: 'emboss'}, 50).bevel);
  assert.equal(resolveLook({style: 'reflect'}, 50).reflection!.opacity, 0.3);
  const t = resolveLook({rotate: 10, flip: 'both', font: 'mono', arc: 90}, 50);
  assert.deepEqual([t.rotate, t.flipH, t.flipV, t.font, t.arc], [10, true, true, 'mono', 90]);
  assert.throws(() => wordart('x', {arc: 0}), /arc/);
  assert.throws(() => wordart('x\ny', {arc: 30}), /newline/);
  assert.throws(() => wordart('x', {arc: 30, writing: 'vertical'}), /horizontal/);
  assert.throws(() => wordart('x', {flip: 'up' as never}), /flip/);
  assert.throws(() => wordart('x', {glow: {radius: 0}}), /glow radius/);
  assert.throws(() => wordart('x', {reflection: {opacity: 2}}), /opacity/);
  assert.throws(() => wordart('x', {gradient: {from: 'red' as never, to: 'text'}}), /gradient from/);
});

test('layers are a pure list, bottom to top, and only the last is the text', () => {
  const layers = (opts: object) => { const a = place('光', opts); return {a, l: paintLayers(a, 'blue')}; };
  const {l} = layers({style: 'sticker', glow: true, extrude: true, bevel: true, reflection: true});
  assert.ok(l[0].mirror, 'the mirror image is first');
  assert.equal(l.filter(x => !x.hidden).length, 1);
  assert.ok(l[l.length - 1].text && !l[l.length - 1].hidden);
  assert.ok(l.every((x, i) => i === l.length - 1 || x.hidden));
  assert.equal(l.filter(x => x.opacity === 0.12).length, GLOW_RINGS);
  assert.deepEqual(layers({}).l.length, 1);
  const hollow = layers({tone: 'none', outline: {tone: 'accent', width: 2}}).l[0];
  assert.equal(hollow.fill, 'none');
  assert.equal(hollow.sw, 2, 'a hollow letter is the rim itself');
  const grad = layers({style: 'gradient'});
  assert.match(grad.l[0].fill, /^url\(#wa/);
  assert.ok(gradientOf(grad.a, 'blue'));
  assert.equal(gradientOf(layers({}).a, 'blue'), undefined);
});

test('hollow and gradient letters are judged like the rest', () => {
  assert.match(legibilityProblem(resolveLook({tone: 'none'}, 40), 'blue')!, /need an outline/);
  assert.equal(legibilityProblem(resolveLook({tone: 'none', outline: {tone: 'text'}}, 40), 'blue'), null);
  assert.match(legibilityProblem(resolveLook({tone: 'none', outline: {tone: 'bg'}}, 40), 'blue')!, /hollow/);
  assert.equal(legibilityProblem(resolveLook({style: 'gradient'}, 40), 'blue'), null);
  assert.match(legibilityProblem(resolveLook({gradient: {from: 'text', to: 'bg'}}, 40), 'blue')!, /barely differ/);
});

test('legibility is judged on the colours as drawn, along the whole gradient, and a hairline is not a rim', () => {
  const paintDark = paintOf('dark');
  // amber: accent on a text-coloured plate reads in the light set (3.48) but not in the dark one (1.80)
  const sign = resolveLook({tone: 'accent', plate: 'text'}, 40);
  assert.equal(legibilityProblem(sign, 'amber'), null);
  assert.match(legibilityProblem(sign, 'amber', paintDark)!, /barely differ/);
  // both ends read against the plate, the middle melts into it
  const grad = resolveLook({gradient: {from: 'bg', to: 'text', angle: 0}, plate: 'accent'}, 40);
  assert.match(legibilityProblem(grad, 'amber')!, /gradient from bg to text/);
  assert.ok(gradientSteps('#000000', '#ffffff').length === 11 && gradientSteps('#000000', '#ffffff')[5] === '#808080');
  // a 0.2px rim does not make a white letter read; a proper one does
  assert.match(legibilityProblem(resolveLook({tone: 'bg', outline: {tone: 'text', width: 0.2}}, 40), 'blue')!, /hairline/);
  assert.equal(legibilityProblem(resolveLook({tone: 'bg', outline: {tone: 'text', width: 2}}, 40), 'blue'), null);
  assert.match(legibilityProblem(resolveLook({tone: 'none', outline: {tone: 'text', width: 0.2}}, 40), 'blue')!, /hairline/);
  assert.ok(minRim(100) === 3 && minRim(20) === 1);
});

test('the ink reaches every side a shadow or a depth is pushed to; odd numbers are refused', () => {
  const reach = (o: object) => inkReach(resolveLook(o, 40));
  assert.deepEqual(reach({shadow: {dx: 4, dy: 6}}), {left: 0, top: 0, right: 4, bottom: 6});
  assert.deepEqual(reach({shadow: {dx: -4, dy: -6}}), {left: 4, top: 6, right: 0, bottom: 0});
  assert.deepEqual(reach({shadow: {dx: -4, dy: 6}, outline: {width: 2}}), {left: 6, top: 2, right: 2, bottom: 8});
  assert.throws(() => wordart('x', {shadow: {dx: NaN}}), /shadow dx/);
  assert.throws(() => wordart('x', {shadow: {dy: Infinity}}), /shadow dy/);
  assert.throws(() => wordart('x', {reflection: {gap: -40}}), /reflection gap/);
  assert.throws(() => wordart('x', {reflection: {gap: NaN}}), /reflection gap/);
  assert.throws(() => wordart('x', {spacing: Infinity}), /spacing/);
  assert.throws(() => wordart('x', {tone: 'none', outline: [{tone: 'accent'}, {tone: 'text'}]}), /one outline/);
  assert.doesNotThrow(() => wordart('x', {tone: 'none', outline: {tone: 'accent'}}));
});

test('a negative shadow is inside the band the layout makes', () => {
  const f = place('影', {shadow: {dx: -30, dy: -30}, size: 40});
  const text = f.labelBoxes[0];
  assert.ok(text.x - 30 >= f.x - .5 && text.y - 30 >= f.y - .5, 'the shadow copy (30px up and left) is within the rect');
});

test('the constructor refuses what would draw NaN or crash, and reads a Windows source', () => {
  assert.throws(() => wordart('x', {style: 'constructor' as never}), /style must be one of/);
  assert.throws(() => wordart('x', {weight: 'toString' as never}), /weight/);
  assert.throws(() => wordart('x', {size: 'huge' as never}), /must be a role/);
  assert.doesNotThrow(() => wordart('x', {size: 'display'}));
  assert.throws(() => wordart('​​'), /non-empty/);
  assert.equal(wordart('あ\r\nい').text, 'あ\nい');
  assert.throws(() => wordart('A', {arc: 90}), /two letters or more/);
  assert.throws(() => wordart('縦書き', {writing: 'vertical', reflection: true}), /reflection/);
  assert.throws(() => wordart('縦書き', {writing: 'vertical', style: 'reflect'}), /reflection/);
  assert.doesNotThrow(() => wordart('縦書き', {writing: 'vertical', style: 'reflect', reflection: false}));
});

test('a depth or a shadow does not default to the colour of the letters', () => {
  assert.equal(resolveLook({extrude: true}, 40).extrude!.tone, 'muted', 'text letters: muted depth');
  assert.equal(resolveLook({extrude: true, tone: 'accent'}, 40).extrude!.tone, 'text');
  assert.equal(resolveLook({shadow: true, tone: 'muted'}, 40).shadow!.tone, 'text');
  assert.equal(resolveLook({shadow: true}, 40).shadow!.tone, 'muted');
});

test('every preset reads at every size from 14px to 160px (the outline is rounded up, never under minRim)', () => {
  for (const style of Object.keys(PRESETS) as (keyof typeof PRESETS)[]) for (let size = 14; size <= 160; size++) {
    const look = resolveLook({style}, size);
    assert.equal(legibilityProblem(look, 'blue'), null, `${style} at ${size}px`);
    for (const o of look.outlines) assert.ok(o.width >= minRim(size), `${style} at ${size}px: a ${o.width}px outline`);
  }
});

test('hollow letters with two outlines are refused, also when a preset brings them', () => {
  assert.throws(() => wordart('中抜き', {style: 'sticker', tone: 'none', plate: 'accent'}), /one outline, and style 'sticker'/);
  assert.doesNotThrow(() => wordart('中抜き', {style: 'sticker', tone: 'none', outline: {tone: 'accent'}}));
  assert.doesNotThrow(() => wordart('中抜き', {style: 'outline', tone: 'none'}));
});

test('the id of a gradient follows its colours: one figure in two themes has two defs', () => {
  const art = place('同じ', {style: 'gradient'});
  assert.notEqual(gradientId(art, 'blue'), gradientId(art, 'amber'));
  assert.equal(gradientId(art, 'blue'), gradientId(art, 'blue'));
  assert.ok(gradientId(art, 'blue').startsWith(art.uid));
  assert.equal(paintLayers(art, 'amber')[0].fill, `url(#${gradientId(art, 'amber')})`);
});
