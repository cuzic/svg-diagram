// A flow shape (chevron / funnel / cycle / venn / concentric / emblem) out of the spotlight dims itself: muted outline and text, white fill.
// renderBand used to turn every fill of a dimmed band muted, so a filled shape and its muted text became one colour and the text vanished.
import test from 'node:test';
import './helpers/strict-width.ts';
import assert from 'node:assert/strict';
import {chevron, closeMeasurer, cycle, diagram, emblem, funnel, renderDiagram, venn} from '../lib/dsl.ts';
import {PALETTE} from '../lib/tokens.ts';

test.after(() => closeMeasurer());

const svgOf = async (...bands: unknown[]) => (await renderDiagram(diagram({theme: 'blue', spotlight: 'lit'}).add(chevron([{id: 'lit', label: '強調'}]), ...(bands as never[])), {name: 'dim.svg', budget: 'cacheOnly'})).svg;
const fills = (svg: string, tag: string) => [...svg.matchAll(new RegExp(`<${tag} [^>]*?fill="(#[0-9a-fA-F]{6})"`, 'g'))].map(m => m[1]!.toLowerCase());

test('a dimmed band with filled shapes: the fill is white, the text and outline muted, so the text is still readable', async () => {
  const svg = await svgOf(funnel([{label: '訪問', tone: 'accent'}, {label: '成約', tone: 'muted'}]), emblem([{label: '重要', shape: 'hexagon', tone: 'accent'}, {label: '済み', tone: 'new'}]));
  for (const tag of ['polygon', 'circle']) for (const f of fills(svg, tag)) assert.equal(f, PALETTE.bg.toLowerCase(), `a dimmed <${tag}> fill is the page colour, not ${f}`);
  const texts = fills(svg, 'text').filter(f => f !== PALETTE.text.toLowerCase());
  assert.ok(texts.includes(PALETTE.muted.toLowerCase()), 'the dimmed text is muted');
  assert.ok(!svg.includes(`fill="${PALETTE.muted}" stroke="${PALETTE.muted}"`) || svg.includes('fill-opacity'), 'no opaque muted-on-muted shape');
});

test('the lit band keeps its colours; a dimmed cycle takes the dimmed arrowhead; a tinted ring stays translucent', async () => {
  const svg = await svgOf(cycle([{label: '計画'}, {label: '実行'}, {label: '確認'}]), venn([{name: '甲'}, {name: '乙'}]));
  assert.match(svg, /marker-end="url\(#dsl-arrow-dim\)"/, 'the cycle arrows are the dimmed ones');
  assert.doesNotMatch(svg, /url\(#dsl-arrow\)/, 'no bright arrowhead in a dimmed band');
  assert.match(svg, /fill-opacity="0\.22"/, 'a venn circle keeps its translucent fill');
  const lit = await renderDiagram(diagram({theme: 'blue', spotlight: 'a'}).add(emblem([{id: 'a', label: '強調', tone: 'accent'}])), {name: 'lit.svg', budget: 'cacheOnly'});
  assert.ok(fills(lit.svg, 'circle').some(f => f !== PALETTE.bg.toLowerCase()), 'a lit emblem keeps its tone fill');
});

test('an emblem drawn as a filled path (pill / rounded / document / cylinder) dims like a polygon: white fill, muted outline and text', async () => {
  const svg = await svgOf(emblem([{label: '開始', shape: 'pill', tone: 'accent'}, {label: '報告書', shape: 'document', tone: 'accent'}, {label: '顧客DB', shape: 'cylinder', tone: 'danger'}, {label: '処理', shape: 'rounded', tone: 'muted'}]));
  const paths = [...svg.matchAll(/<path [^>]*?fill="(#[0-9a-fA-F]{6})"[^>]*?stroke="(#[0-9a-fA-F]{6})"/g)];
  assert.equal(paths.length, 4, 'the four filled paths');
  for (const m of paths) assert.deepEqual([m[1]!.toLowerCase(), m[2]!.toLowerCase()], [PALETTE.bg.toLowerCase(), PALETTE.muted.toLowerCase()], 'a dimmed filled path: white fill, muted outline');
  assert.ok(fills(svg, 'text').filter(f => f !== PALETTE.text.toLowerCase()).every(f => f === PALETTE.muted.toLowerCase()), 'the dimmed text is muted');
});
