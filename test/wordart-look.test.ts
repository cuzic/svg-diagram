import test from 'node:test';
import './helpers/strict-width.ts'; // a text the layout did not register for measuring throws instead of measuring 0 wide
import assert from 'node:assert/strict';
import {wordart} from '../lib/dsl.ts';
import {GLOW_RINGS, gradientOf, legibilityProblem, paintLayers, resolveLook} from '../lib/wordart.ts';
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
  assert.throws(() => wordart('x', {size: 10}), /at least 14px/);
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
