// ADR 0022 U4: diagram({status: 'draft'}) draws a strip with a badge at the top right; a figure without a status is unchanged.
import test from 'node:test';
import assert from 'node:assert/strict';
import './helpers/strict-width.ts';
import {box, caption, checkDiagram, closeMeasurer, connect, diagram, renderDiagram, row} from '../lib/dsl.ts';
import type {LaidOutStatus} from '../lib/types/containers.ts';

test.after(() => closeMeasurer());

const make = (o: object = {}) => diagram({theme: 'blue', ...o} as never).add(caption('見出し', {role: 'title'} as never), row([box({id: 'a', title: '入口'}), box({id: 'b', title: '出口'})]), connect('a:right', 'b:left'));
const render = (o: object = {}, html = false) => renderDiagram(make(o), {name: 'x.svg', budget: 'cacheOnly', html});
const statusOf = (r: Awaited<ReturnType<typeof render>>) => r.laidOut.laidOut.find(b => b.type === 'status') as LaidOutStatus | undefined;

test('a draft figure carries the badge: one accessible group with the wording, a dashed outline', async () => {
  const r = await render({status: 'draft'});
  assert.deepEqual(r.verdict.problems, []);
  const g = /<g role="img" aria-label="下書き" data-status="draft">([\s\S]*?)<\/g>/.exec(r.svg);
  assert.ok(g, 'the badge group');
  assert.match(g[1], /stroke-dasharray=/);
  assert.match(g[1], />下書き<\/text>/);
  const s = statusOf(r)!;
  assert.ok(s.pill.x + s.pill.w <= s.x + s.w + 0.5 && s.pill.x + s.pill.w >= s.x + s.w - 4.5, 'at the right end');
  assert.ok(r.laidOut.laidOut[0] === s, 'the first band');
});

test('statusLabel replaces the wording', async () => {
  const r = await render({status: 'draft', statusLabel: '仮説'});
  assert.match(r.svg, /aria-label="仮説" data-status="draft"/);
  assert.doesNotMatch(r.svg, /下書き/);
});

test('without a status nothing changes: no band, no group', async () => {
  const r = await render({});
  assert.equal(statusOf(r), undefined);
  assert.doesNotMatch(r.svg, /data-status/);
});

test('the badge strip and the source line never overlap, and the strip is above the content', async () => {
  const r = await render({status: 'draft', sourceLine: '出典: テスト'});
  const s = statusOf(r)!;
  const src = r.laidOut.laidOut.find(b => b.type === 'caption' && b.sourceLine)!;
  const content = r.laidOut.laidOut.filter(b => b.type !== 'status');
  assert.ok(s.y + s.h <= src.y);
  for (const b of content) assert.ok(s.y + s.h <= (b as {y: number}).y + 0.5, `${b.type} starts below the strip`);
});

test('the badge is not the title of the figure', async () => {
  const r = await render({status: 'draft'});
  assert.doesNotMatch(r.svg, /<title[^>]*>[^<]*下書き/);
});

test('appearance: dark recolours the badge with the tokens, and the figure still passes', async () => {
  const light = await render({status: 'draft'}), dark = await render({status: 'draft', appearance: 'dark'});
  const rect = (svg: string) => /data-status="draft">\s*<rect[^>]*fill="(#\w+)"[^>]*stroke="(#\w+)"/.exec(svg)!.slice(1);
  assert.notDeepEqual(rect(light.svg), rect(dark.svg));
  assert.deepEqual(dark.verdict.problems, []);
});

test('a transparent figure and a spotlight figure keep the badge as it is', async () => {
  const r = await renderDiagram(make({status: 'draft', transparent: true, spotlight: 'a'}), {name: 'x.svg', budget: 'cacheOnly'});
  assert.deepEqual(r.verdict.problems, []);
  assert.equal((statusOf(r) as {dim?: boolean}).dim, undefined, 'not dimmed');
  assert.ok(r.laidOut.laidOut.some(b => (b as {dim?: boolean}).dim === true), 'while the spotlight does dim something else');
});

test('--html: the badge is in the HTML output too', async () => {
  const r = await render({status: 'draft', statusLabel: '仮置き'}, true);
  assert.ok(r.html?.includes('仮置き'));
});

test('a slide canvas keeps the badge text at the canvas minimum', async () => {
  const {verdict} = await checkDiagram(make({status: 'draft', canvas: 'slide'}) as never);
  assert.ok(!verdict.findings.some(f => f.rule === 'slide-min-text'), verdict.findings.map(f => f.message).join('\n'));
  assert.deepEqual(verdict.problems, []);
});

test('a badge wider than the figure is refused with the way out', async () => {
  await assert.rejects(() => render({status: 'draft', statusLabel: 'あ'.repeat(80)}), /shorten statusLabel/);
});
