// ADR 0081 D4 (U2): TreeItem.tags — coloured tags in the top row of a tree node.
import test from 'node:test';
import assert from 'node:assert/strict';
import './helpers/strict-width.ts'; // a label the layout did not register for measuring throws instead of measuring 0 wide
import {box, checkDiagram, closeMeasurer, diagram, mindmap, renderDiagram, tree} from '../lib/dsl.ts';
import {tree as treeBand} from '../lib/bands/tree.ts';
import {treeTagColors} from '../lib/emit-tree.ts';
import {toneEnv} from '../lib/tokens.ts';
import {nodeRuns} from '../lib/tree.ts';
import {PALETTE, colorOf} from '../lib/tokens.ts';
import {planSlide, fontsOf} from '../lib/pptx/slide.ts';
import type {LaidOutTree, TreeItem} from '../lib/types/diagrams.ts';

test.after(() => closeMeasurer());

const item = (tags: TreeItem['tags'], extra: Partial<TreeItem> = {}): TreeItem => ({
  label: '導入するか', id: 'root',
  children: [{label: '費用が下がる', id: 'a', ...(tags ? {tags} : {}), ...extra}, {label: '移行に時間がかかる', id: 'b'}],
});
const render = (band: object, opts: Parameters<typeof diagram>[0] = {theme: 'blue'}) => renderDiagram(diagram(opts).add(band as never), {name: 't.svg', budget: 'cacheOnly'});
const laidTree = async (band: object, opts: Parameters<typeof diagram>[0] = {theme: 'blue'}) => {
  const {laidOut, verdict} = await checkDiagram(diagram(opts).add(band as never));
  return {t: laidOut.laidOut.find(b => b.type === 'tree') as LaidOutTree, verdict};
};
const rects = (svg: string) => [...svg.matchAll(/<rect x="(-?[\d.]+)" y="(-?[\d.]+)" width="([\d.]+)" height="([\d.]+)" rx="([\d.]+)" fill="(#\w+)"( stroke)?/g)].map(m => ({x: +(m[1] as string), y: +(m[2] as string), w: +(m[3] as string), h: +(m[4] as string), rx: +(m[5] as string), fill: m[6] as string, stroked: !!m[7]}));

test('sizes: a tag is 24px high with 8px padding, 6px apart, and sits in the top row above the label', async () => {
  const {t, verdict} = await laidTree(tree(item(['決定', {text: '反対', tone: 'danger'}]), {dir: 'right'}));
  assert.equal(verdict.ok, true, verdict.problems?.join('\n'));
  const a = t.nodes.find(n => n.id === 'a') as LaidOutTree['nodes'][number], tags = a.tags ?? [];
  assert.equal(tags.length, 2);
  for (const g of tags) { assert.equal(g.h, 24); assert.equal(g.y, a.y + 8, 'the row starts below the 8px padding'); assert.equal(g.size, 14); assert.equal(g.baseline, g.y + 17); }
  assert.equal((tags[1] as {x: number}).x - ((tags[0] as {x: number}).x + (tags[0] as {w: number}).w), 6);
  const rowW = tags.reduce((s, g) => s + g.w, 0) + 6;
  assert.ok(Math.abs((tags[0] as {x: number}).x - (a.x + (a.w - rowW) / 2)) < 0.01, 'centred');
  const label = t.texts.find(x => x.text.includes('費用'));
  assert.ok(label && label.y - label.size > a.y + 8 + 24 + 4 - 1, 'the label starts below the row and its 4px');
  assert.equal(t.nodes.find(n => n.id === 'b')?.tags, undefined);
  assert.ok(!t.texts.some(x => x.text === '決定'), 'tags are not in texts');
});

test('a node with tags is taller by the row (24 + 4) and only wider when the row needs it', async () => {
  const plain = (await laidTree(tree(item(undefined), {dir: 'right'}))).t.nodes.find(n => n.id === 'a') as LaidOutTree['nodes'][number];
  const one = (await laidTree(tree(item(['決定']), {dir: 'right'}))).t.nodes.find(n => n.id === 'a') as LaidOutTree['nodes'][number];
  assert.equal(one.h - plain.h, 28);
  assert.equal(one.w, plain.w, 'a short tag fits the box that was there');
  const wide = (await laidTree(tree(item(['abcdefgh', 'ABCDEFGH', 'ijklmnop']), {dir: 'right'}))).t.nodes.find(n => n.id === 'a') as LaidOutTree['nodes'][number];
  const rowW = (wide.tags ?? []).reduce((s, g) => s + g.w, 0) + 12;
  assert.ok(wide.w > plain.w);
  assert.ok(wide.w >= rowW + 28, 'the box is the row plus 2 x 14');
  assert.ok((wide.tags ?? []).every(g => g.x >= wide.x + 14 - 0.01 && g.x + g.w <= wide.x + wide.w - 14 + 0.01));
});

test('canvas: slide scales the tag with roles.tag and the text stays inside, with no overflow finding', async () => {
  const {t, verdict} = await laidTree(mindmap(item(['決定', '要確認']), {layout: 'right'}), {theme: 'blue', canvas: 'slide'});
  assert.equal(verdict.ok, true, verdict.problems?.join('\n'));
  const g = (t.nodes.find(n => n.id === 'a')?.tags ?? [])[0] as NonNullable<LaidOutTree['nodes'][number]['tags']>[number];
  const f = g.size;
  assert.ok(f > 14, `roles.tag grows on a slide canvas (${f})`);
  const s = f / 14;
  assert.equal(g.h, Math.round(24 * s));
  assert.equal(g.baseline, g.y + Math.round(17 * s));
  assert.equal(verdict.findings.filter(x => /overflow|clip|outside|overlap/i.test(x.rule)).length, 0, JSON.stringify(verdict.findings.map(x => x.rule)));
  const {svg} = await render(mindmap(item(['決定', '要確認']), {layout: 'right'}), {theme: 'blue', canvas: 'slide'});
  assert.match(svg, new RegExp(`font-size="${f}" font-weight="700" fill="#ffffff">決定`));
});

test('colours: accent, danger and muted tags are white text on the tone colour; a tag has no stroke and no data-node', async () => {
  const {svg} = await render(tree(item(['a', {text: 'b', tone: 'danger'}, {text: 'c', tone: 'muted'}]), {dir: 'right'}));
  const pills = rects(svg).filter(r => r.h === 24 && r.rx === 12);
  assert.deepEqual(pills.map(p => p.fill), [colorOf('accent', 'blue'), colorOf('danger', 'blue'), PALETTE.muted].map(c => c.toLowerCase()));
  assert.ok(pills.every(p => !p.stroked));
  assert.doesNotMatch(svg, /<rect[^>]*rx="12"[^>]*data-node/);
  assert.match(svg, />a<\/text>/);
  assert.equal([...svg.matchAll(/font-weight="700" fill="#ffffff">[abc]</g)].length, 3);
});

test('draw order: the box rect, then the tag rect and text, then the node text', async () => {
  const {svg} = await render(tree(item(['決定']), {dir: 'right'}));
  const box = svg.lastIndexOf('rx="8"'), pill = svg.indexOf('rx="12"'), tagText = svg.indexOf('>決定<'), label = svg.indexOf('費用が下がる');
  assert.ok(box < pill && pill < tagText && tagText < label, [box, pill, tagText, label].join(' '));
});

test('a solid box inverts an accent tag: white fill, accent text', async () => {
  const {svg} = await render(tree(item(['決定'], {tone: 'solid'}), {dir: 'right'}));
  const pill = rects(svg).find(r => r.rx === 12 && r.h === 24);
  assert.equal(pill?.fill, '#ffffff');
  assert.match(svg, new RegExp(`font-weight="700" fill="${colorOf('accent', 'blue')}">決定`, 'i'));
  // a danger tag in a solid-danger box inverts too, but a danger tag in a solid box does not
  const sd = await render(tree(item([{text: '反対', tone: 'danger'}], {tone: 'solid-danger'}), {dir: 'right'}));
  assert.equal(rects(sd.svg).find(r => r.rx === 12)?.fill, '#ffffff');
  const mixed = await render(tree(item([{text: '反対', tone: 'danger'}], {tone: 'solid'}), {dir: 'right'}));
  assert.equal(rects(mixed.svg).find(r => r.rx === 12)?.fill, colorOf('danger', 'blue').toLowerCase());
});

test('inversion is decided by the resolved colour: a tones override that makes solid and the tag the same colour inverts', async () => {
  const same = '#8844aa';
  const band = tree(item(['決定'], {tone: 'solid'}), {dir: 'right'});
  const over = await render(band, {theme: 'blue', tones: {accent: {ink: same}, solid: {fill: same}}} as never);
  const pill = rects(over.svg).find(r => r.rx === 12 && r.h === 24);
  assert.equal(pill?.fill, '#ffffff');
  assert.match(over.svg, new RegExp(`fill="${same}">決定`));
  const differ = await render(band, {theme: 'blue', tones: {accent: {ink: same}, solid: {fill: '#112233'}}} as never);
  assert.equal(rects(differ.svg).find(r => r.rx === 12 && r.h === 24)?.fill, same);
});

test('precedence: a muted node (focus, not lit) takes a muted tag whatever the tag tone is', async () => {
  const {svg} = await render(tree(item([{text: '反対', tone: 'danger'}]), {dir: 'right', focus: 'b'}));
  assert.equal(rects(svg).find(r => r.rx === 12 && r.h === 24)?.fill, PALETTE.muted);
  const lit = await render(tree(item([{text: '反対', tone: 'danger'}]), {dir: 'right', focus: 'a'}));
  // the focused node is solid: a danger tag stays danger (colour differs from the solid accent fill)
  assert.equal(rects(lit.svg).find(r => r.rx === 12 && r.h === 24)?.fill, colorOf('danger', 'blue').toLowerCase());
  const litAccent = await render(tree(item(['決定']), {dir: 'right', focus: 'a'}));
  assert.equal(rects(litAccent.svg).find(r => r.rx === 12 && r.h === 24)?.fill, '#ffffff', 'an accent tag in the solid focused node inverts');
});

test('dim (spotlight): the tags of a dimmed tree are muted with white text, not inverted (even in a solid box)', async () => {
  const d = diagram({theme: 'blue', spotlight: 'keep'}).add(box({id: 'keep', title: 'ここ'}), tree(item(['決定'], {tone: 'solid'}), {dir: 'right'}));
  const {svg} = await renderDiagram(d, {name: 't.svg', budget: 'cacheOnly'});
  assert.equal(rects(svg).find(r => r.rx === 12 && r.h === 24)?.fill, PALETTE.muted);
  assert.match(svg, />決定<\/text>/);
  assert.match(svg, /font-weight="700" fill="#ffffff">決定/);
});

test('errors: empty, 9 code points, 4 tags, bad tone, and a band node', () => {
  assert.throws(() => tree(item([''])), /tag needs text/);
  assert.throws(() => tree(item(['  '])), /tag needs text/);
  assert.throws(() => tree(item(['あいうえおかきくけ'])), /9 characters[\s\S]*the most is 8/);
  assert.throws(() => tree(item(['a', 'b', 'c', 'd'])), /4 tags[\s\S]*the most is 3/);
  assert.throws(() => tree(item([{text: 'x', tone: 'solid' as never}])), /tone solid/);
  assert.throws(() => mindmap(item(['', 'a'])), /tag needs text/);
  assert.doesNotThrow(() => tree(item(['あいうえおかきく'])), '8 characters');
  assert.doesNotThrow(() => tree(item(['😀😀😀😀😀😀😀😀'])), 'counted in code points');
  assert.throws(() => tree({label: 'r', children: [{label: 'b', band: treeBand({label: 'x'}), w: 100, tags: ['x']}]}), /band node takes no tags/);
});

test('every layout draws tags, including brace, fishbone and timeline', async () => {
  for (const layout of ['radial', 'right', 'left', 'down', 'up', 'org', 'list', 'brace', 'fishbone', 'timeline'] as const) {
    const {t, verdict} = await laidTree(mindmap(item(['決定', '要確認']), {layout}));
    assert.equal(verdict.ok, true, `${layout}: ${verdict.problems?.join('\n')}`);
    const a = t.nodes.find(n => n.id === 'a');
    assert.equal(a?.tags?.length, 2, layout);
    for (const g of a?.tags ?? []) assert.ok(g.x >= (a as {x: number}).x && g.x + g.w <= (a as {x: number; w: number}).x + (a as {w: number}).w && g.y + g.h <= (a as {y: number; h: number}).y + (a as {h: number}).h, `${layout}: inside the box`);
  }
  for (const dir of ['down', 'right', 'auto'] as const) assert.equal((await laidTree(tree(item(['決定']), {dir}))).verdict.ok, true, dir);
});

test('the root may carry tags', async () => {
  const {t} = await laidTree(tree({...item(undefined), tags: ['決定']}, {dir: 'right'}));
  assert.equal(t.nodes[0]?.tags?.length, 1);
});

test('PPTX: a tag is a roundRect (adj 50000) after its node box, centred text in the tag colours', async () => {
  const {laidOut} = await render(tree(item(['決定', {text: '反対', tone: 'danger'}]), {dir: 'right'}));
  const xml = planSlide(laidOut, fontsOf()).xml;
  const tags = [...xml.matchAll(/<p:sp>(?:(?!<\/p:sp>)[\s\S])*?name="tag: ([^"]*)"(?:(?!<\/p:sp>)[\s\S])*?<\/p:sp>/g)];
  assert.deepEqual(tags.map(m => m[1]), ['決定', '反対']);
  const first = tags[0]?.[0] as string;
  assert.match(first, /prst="roundRect"[\s\S]*fmla="val 50000"/);
  assert.match(first, /anchor="ctr"/);
  assert.match(first, new RegExp(`<a:solidFill><a:srgbClr val="${colorOf('accent', 'blue').slice(1).toUpperCase()}"/></a:solidFill><a:ln><a:noFill/>`));
  assert.match(first, /<a:srgbClr val="FFFFFF"\/>[\s\S]*<a:t>決定<\/a:t>|<a:t>決定<\/a:t>/);
  assert.match(first, /sz="1050"/, '14px is 10.5pt, as the node text conversion');
  const boxAt = xml.indexOf('name="box: 費用が下がる'), tagAt = xml.indexOf('name="tag: 決定');
  assert.ok(boxAt > 0 && tagAt > boxAt, 'the tag follows its box');
});

test('no tags: tags: [] and no tags are byte-identical (svg and pptx), and nodeRuns without tagRowH is as before', async () => {
  const none = await render(tree(item(undefined), {dir: 'right'})), empty = await render(tree(item([]), {dir: 'right'}));
  assert.equal(empty.svg, none.svg);
  assert.equal(planSlide(empty.laidOut, fontsOf()).xml, planSlide(none.laidOut, fontsOf()).xml);
  assert.doesNotMatch(none.svg, /rx="12"/);
  const roles = {body: 16, note: 12} as never;
  const lines = {label: ['a'], sub: ['b'], w: 100, h: 60};
  const runs = nodeRuns({x: 0, y: 10, w: 100}, lines, roles);
  assert.deepEqual(runs.map(r => r.y), [10 + 8 + 16, 10 + 8 + Math.round(16 * 1.4) + 12]);
  assert.equal(nodeRuns({x: 0, y: 10, w: 100}, {...lines, tagRowH: 28}, roles)[0]?.y, 10 + 8 + 28 + 16);
});

test('treeTagColors: dim, muted node, equal colours (inverted), then plain, in that order', () => {
  const env = toneEnv(undefined as never);
  const accent = colorOf('accent', 'blue');
  assert.deepEqual(treeTagColors('solid', 'accent', true, 'blue', env), {fill: PALETTE.muted, text: PALETTE.bg}, 'dim first');
  assert.deepEqual(treeTagColors('muted', 'danger', false, 'blue', env), {fill: PALETTE.muted, text: PALETTE.bg}, 'then a muted node');
  assert.deepEqual(treeTagColors('solid', 'accent', false, 'blue', env), {fill: PALETTE.bg, text: accent}, 'then equal colours');
  assert.deepEqual(treeTagColors('plain', 'accent', false, 'blue', env), {fill: accent, text: PALETTE.bg});
});
