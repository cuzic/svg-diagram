import test from 'node:test';
import assert from 'node:assert/strict';
import {box, caption, checkDiagram, closeMeasurer, diagram, row, timeline} from '../lib/dsl.ts';
import {layoutDiagram} from '../lib/layout-measured.ts';
import {emitSvg} from '../lib/emit.ts';
import {ROLES} from '../lib/tokens.ts';
import type {LaidOutTimeline} from '../lib/dsl.ts';

test.after(() => closeMeasurer());

const BASE = {from: '2026', to: '2029', now: {at: '2026-10'}, deadline: {at: '2028-03-31', label: 'サポート終了'}};
const tl = (laid: {laidOut: {type: string}[]}) => laid.laidOut.find((b): b is LaidOutTimeline => b.type === 'timeline')!;

test('timeline({until}): it vanishes at its click like every other band', async () => {
  const laid = (await checkDiagram(diagram({theme: 'blue', title: 't'}).add(box({title: 'a'}), timeline({...BASE, reveal: 1, until: 2})))).laidOut;
  assert.equal(tl(laid).until, 2);
  assert.match(emitSvg(laid, {reveal: 1}), /サポート終了/);
  assert.doesNotMatch(emitSvg(laid, {reveal: 0}), /サポート終了/);
  assert.doesNotMatch(emitSvg(laid, {reveal: 2}), /サポート終了/);
});

test('timeline text follows the roles of the layout (fill / canvas), and the slide minimum sees it', async () => {
  const d = () => diagram({theme: 'blue', title: 't'}).add(timeline(BASE));
  const roles = {...ROLES, note: 25};
  const laid = await layoutDiagram(d(), {roles});
  assert.ok(tl(laid).texts.every(t => t.size === 25));
  const svg = emitSvg(laid);
  assert.doesNotMatch(svg, /font-size="14"/);
  assert.match(svg, /font-size="25"/);
  // a whole-slide canvas scales the figure until its smallest text is the canvas minimum: no slide-min-text from the timeline
  const slide = await checkDiagram(diagram({canvas: 'slide', theme: 'blue', title: 't'}).add(caption('見出し'), timeline(BASE)));
  assert.ok(!slide.verdict.findings.some(f => f.rule === 'slide-min-text'), JSON.stringify(slide.verdict.findings));
  assert.ok(tl(slide.laidOut).texts.every(t => t.size >= 24));
});

test('timeline: flags on the same day are one flag; "deadline today" draws', async () => {
  const same = await checkDiagram(diagram({theme: 'blue', title: 't'}).add(timeline({...BASE, now: {at: '2028-03-31', label: '今'}, marks: [{at: '2028-03-31', label: '最終出社'}]})));
  assert.ok(same.verdict.ok, same.verdict.problems.join('\n'));
  const t = tl(same.laidOut);
  assert.equal(t.stems.length, 1);
  assert.ok(t.texts.some(x => x.text === '今・サポート終了・最終出社' && x.fill === 'danger'));
  assert.ok(t.texts.some(x => x.text === '期限は今日'));
  assert.equal(t.bracket, undefined);
  const full = await checkDiagram(diagram({theme: 'blue', title: 't'}).add(timeline({...BASE, now: {at: '2028-03-31'}, deadline: {...BASE.deadline, line: 'full'}})));
  assert.ok(full.verdict.ok, full.verdict.problems.join('\n'));
});

test('timeline: an empty now.label throws (leave it out for 現在)', () => {
  assert.throws(() => timeline({...BASE, now: {at: '2026-10', label: ''}}), /now.label must not be empty/);
  assert.doesNotThrow(() => timeline({...BASE, now: {at: '2026-10'}}));
});

test('spotlight: the pinned source line is never dimmed; a dimmed timeline draws muted with a white ring', async () => {
  const d = diagram({theme: 'blue', title: 't', spotlight: 'main', sourceLine: '出典: 総務省'}).add(row([box({id: 'main', title: 'M'})]), timeline(BASE));
  const laid = (await checkDiagram(d)).laidOut;
  const last = laid.laidOut.at(-1)!;
  assert.equal(last.type, 'caption');
  assert.ok(!last.dim);
  assert.equal(tl(laid).dim, true);
  const svg = emitSvg(laid);
  const circles = svg.match(/<circle [^>]*>/g)!;
  assert.ok(circles.length > 0 && circles.every(c => c.includes('fill="#6f6659"') && c.includes('stroke="#ffffff"')), circles.join('\n'));
});
