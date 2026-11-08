// A canvas (slide) diagram: the height fits the content, the step badge and the swimlane / quadrant label widths follow the larger text.
import test from 'node:test';
import assert from 'node:assert/strict';
import './helpers/strict-width.ts';
import {box, checkDiagram, closeMeasurer, diagram, quadrant, renderDiagram, row, steps, swimlane} from '../lib/dsl.ts';
import {STEP_BADGE_R, STEP_INDENT, stepBadgeGeom, stepIndent} from '../lib/layout-util.ts';
import {ROLES} from '../lib/tokens.ts';
import type {LaidOutSwimlane} from '../lib/types/sequence-table-swimlane.ts';

test.after(() => closeMeasurer());
const canvas = (fit?: 'content') => ({width: 1280, height: 720, minText: 30, ...(fit ? {fit} : {})});

test("canvas fit: 'content' draws the canvas only as tall as the content; without it the canvas keeps its height", async () => {
  const bands = () => [row([box({title: 'A'}), box({title: 'B'})], {arrows: 'between'})];
  const fixed = await checkDiagram(diagram({theme: 'blue', canvas: canvas()}).add(...bands()));
  const fit = await checkDiagram(diagram({theme: 'blue', canvas: canvas('content')}).add(...bands()));
  assert.equal(fixed.laidOut.canvasHeight, 720);
  assert.ok(fit.laidOut.canvasHeight < 300, String(fit.laidOut.canvasHeight));
  assert.equal(fit.laidOut.canvasHeight, fit.laidOut.contentHeight);
  assert.throws(() => diagram({theme: 'blue', canvas: {...canvas(), fit: 'all' as never}}), /canvas: \{fit\}\}\) must be 'content'/);
});

test('step badge: a document figure keeps the fixed geometry; a canvas grows it with the title, within the title line', () => {
  assert.deepEqual(stepBadgeGeom(ROLES), {r: STEP_BADGE_R, offset: 6, indent: STEP_INDENT, size: 16});
  const big = {...ROLES, title: 32, tag: 30};
  const g = stepBadgeGeom(big);
  assert.ok(g.r > STEP_BADGE_R && g.r <= 0.75 * big.title, String(g.r));
  assert.equal(g.indent, 2 * g.r + 10 * (30 / 14));
  assert.equal(stepIndent(ROLES), STEP_INDENT);
  assert.equal(stepIndent(big), g.indent);
});

test('step badge on a canvas: no lint finding that the badge covers the body line', async () => {
  const {svg} = await renderDiagram(diagram({theme: 'blue', canvas: canvas('content')}).add(steps([{title: 'ログイン', body: '手順の紙を見ながら'}, {title: '新しいチャット', body: '最初の質問を入れる'}], {numbered: true})), {name: 's.svg', budget: 'cacheOnly'});
  const r = Number(svg.match(/data-badge="">\s*<circle[^>]*r="([\d.]+)"/)?.[1]);
  assert.ok(r > STEP_BADGE_R, `the badge grew (r=${r})`);
});

test("swimlane labelW: 'fit' (the default on a canvas) keeps the longest lane name on one line; a document figure keeps 128", async () => {
  const sw = (opts = {}) => swimlane([{id: 'a', label: '意思決定者'}, {id: 'b', label: '担当者'}], [{id: 's', lane: 'a', title: '選ぶ', col: 1}, {id: 't', lane: 'b', title: '作る', col: 2}], opts);
  const onCanvas = await checkDiagram(diagram({theme: 'blue', canvas: canvas('content')}).add(...sw()));
  const lane = onCanvas.laidOut.laidOut.find(b => b.type === 'swimlane') as LaidOutSwimlane;
  assert.ok(lane.labelW > 128, String(lane.labelW));
  assert.equal(lane.lanes[0]?.labelLines.length, 1, 'one line');
  const doc = await checkDiagram(diagram({theme: 'blue'}).add(...sw()));
  assert.equal((doc.laidOut.laidOut.find(b => b.type === 'swimlane') as LaidOutSwimlane).labelW, 128);
  const fitDoc = await checkDiagram(diagram({theme: 'blue'}).add(...sw({labelW: 'fit'})));
  assert.ok((fitDoc.laidOut.laidOut.find(b => b.type === 'swimlane') as LaidOutSwimlane).labelW >= 128);
  assert.throws(() => sw({labelW: -3}), /labelW must be a positive number or 'fit'/);
});

test('quadrant: on a canvas an item label wraps at a width that grows with the text (a short name stays on one line)', async () => {
  const q = () => quadrant({x: {title: 'x', low: '低', high: '高'}, y: {title: 'y', low: '低', high: '高'}, items: [{label: '確認の締切日', cell: [0, 0]}, {label: '電子申請システム連携', cell: [1, 1]}], allowEmpty: true});
  const {svg} = await renderDiagram(diagram({theme: 'blue', canvas: canvas('content')}).add(q()), {name: 'q.svg', budget: 'cacheOnly'});
  assert.match(svg, />確認の締切日</, 'not broken into lines');
});
