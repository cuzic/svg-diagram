// idPrefix / inline (ADR 0012 D2 as options of renderSpec, renderDiagram and renderInBrowser): two figures on one page share no id,
// and every reference resolves inside its own figure; inline output has a viewBox and no width / height.
import test from 'node:test';
import assert from 'node:assert/strict';
import {renderSpec} from '../lib/spec-render.ts';
import {prepareForEmbedding, prepareHtmlForEmbedding, normalizeIdPrefix} from '../lib/svg-ids.ts';

const SPEC = {version: 1, title: '部品の流れ', parts: [{type: 'flowchart', nodes: [{id: 'a', label: '受け取る'}, {id: 'b', label: '確かめる'}], edges: [{from: 'a', to: 'b'}]}]};
const draw = async (opts: {idPrefix?: string; inline?: boolean} = {}) => {
  const r = await renderSpec(SPEC, opts);
  assert.equal(r.ok, true, JSON.stringify(r.problems));
  return r.svg as string;
};
const idsOf = (svg: string) => [...svg.matchAll(/\sid="([^"]+)"/g)].map(m => m[1] as string);
const refsOf = (svg: string) => [
  ...[...svg.matchAll(/url\(#([^)'"\s]+)\)/g)].map(m => m[1] as string),
  ...[...svg.matchAll(/href="#([^"]+)"/g)].map(m => m[1] as string),
  ...[...svg.matchAll(/aria-(?:labelledby|describedby)="([^"]+)"/g)].flatMap(m => (m[1] as string).split(/\s+/)),
];

test('idPrefix: two figures on one page share no id and every reference resolves to its own figure', async () => {
  const one = await draw({idPrefix: 'fig1-'}), two = await draw({idPrefix: 'fig2-'});
  const plain = await draw();
  assert.ok(idsOf(plain).includes('svg-title') && refsOf(plain).length > 0); // the premise: the default shares ids and has references
  const [i1, i2] = [idsOf(one), idsOf(two)];
  assert.deepEqual(i1.filter(i => i2.includes(i)), [], 'no id in common');
  for (const [svg, ids, pre] of [[one, i1, 'fig1-'], [two, i2, 'fig2-']] as const) {
    for (const id of ids) if (id !== 'svg-diagram') assert.ok(id.startsWith(pre), `${id} is prefixed`);
    for (const ref of refsOf(svg)) assert.ok(ids.includes(ref), `${ref} resolves in its own figure`);
  }
});

test('idPrefix: "fig1" and "fig1-" are the same prefix, a bad one throws, no option changes nothing', async () => {
  assert.equal(await draw({idPrefix: 'fig1'}), await draw({idPrefix: 'fig1-'}));
  assert.equal(normalizeIdPrefix('a-'), 'a');
  assert.throws(() => normalizeIdPrefix('1x'), /idPrefix/);
  await assert.rejects(draw({idPrefix: ''}), /idPrefix/);
  const svg = await draw();
  assert.equal(prepareForEmbedding(svg, {}), svg);
  assert.equal(await draw({idPrefix: 'p'}).then(s => s.replaceAll('p-', '')), svg);
});

test('inline: no xml declaration and no width / height on the root, the viewBox stays; the rest is unchanged', async () => {
  const plain = await draw(), inline = await draw({inline: true});
  const root = (s: string) => /<svg\b[^>]*>/.exec(s)?.[0] ?? '';
  assert.match(root(plain), /\swidth="\d+"/);
  assert.doesNotMatch(root(inline), /\s(?:width|height)=/);
  assert.match(root(inline), /viewBox="0 0 \d+ \d+"/);
  assert.equal(inline.replace(root(inline), ''), plain.replace(root(plain), ''));
  const decl = prepareForEmbedding('<?xml version="1.0"?>\n<svg width="3" height="4" viewBox="0 0 3 4"><rect width="3" height="4"/></svg>', {inline: true});
  assert.equal(decl, '<svg viewBox="0 0 3 4"><rect width="3" height="4"/></svg>'); // only the root loses them
});

test('idPrefix and inline together; a <use> and a style selector follow the prefix', () => {
  const src = '<svg width="9" height="9" viewBox="0 0 9 9" aria-labelledby="t d"><title id="t">x</title><desc id="d">y</desc><style>#g { fill: red }</style><defs><g id="g"/></defs><use href="#g"/><use xlink:href="#g"/></svg>';
  const out = prepareForEmbedding(src, {idPrefix: 'k-', inline: true});
  assert.equal(out, '<svg viewBox="0 0 9 9" aria-labelledby="k-t k-d"><title id="k-t">x</title><desc id="k-d">y</desc><style>#k-g { fill: red }</style><defs><g id="k-g"/></defs><use href="#k-g"/><use xlink:href="#k-g"/></svg>');
});

test('HTML form: ids get the prefix and the root takes the prefix as its id', () => {
  const html = '<div id="sd-0123abcd" class="sd"><svg><marker id="m"/><path marker-end="url(#m)"/></svg></div>';
  assert.equal(prepareHtmlForEmbedding(html, {idPrefix: 'h1-'}), '<div id="h1" class="sd"><svg><marker id="h1-m"/><path marker-end="url(#h1-m)"/></svg></div>');
  assert.equal(prepareHtmlForEmbedding(html, {}), html);
});

test('renderDiagram and renderInBrowser take the same options', async () => {
  const {box, closeMeasurer, connect, diagram, renderDiagram, row} = await import('../lib/dsl.ts');
  const {renderInBrowser} = await import('../lib/web.ts');
  const {measure} = await import('./helpers/comic-values.ts');
  const make = (appearance?: 'auto') => diagram({theme: 'blue', title: '試験図', ...(appearance ? {appearance} : {})}).add(row([box({id: 'a', title: '入口'}), box({id: 'b', title: '出口'})]), connect('a:right', 'b:left'));
  try {
    const plain = await renderDiagram(make(), {name: 'x.svg', budget: 'cacheOnly'});
    const r = await renderDiagram(make(), {name: 'x.svg', budget: 'cacheOnly', idPrefix: 'q-', inline: true});
    assert.doesNotMatch(/<svg\b[^>]*>/.exec(r.svg)?.[0] ?? '', /\s(?:width|height)=/);
    for (const id of idsOf(r.svg)) assert.ok(id.startsWith('q-'), id);
    assert.deepEqual(idsOf(r.svg).map(i => i.slice(2)), idsOf(plain.svg));
    assert.equal(r.width, plain.width); // the numbers of the result stay those of the drawing
    const b = await renderInBrowser(make(), {measure, idPrefix: 'w-', inline: true});
    assert.ok(idsOf(b.svg).length > 0 && idsOf(b.svg).every(i => i.startsWith('w-')));
    assert.doesNotMatch(/<svg\b[^>]*>/.exec(b.svg)?.[0] ?? '', /\s(?:width|height)=/);
    // appearance: 'auto' keeps working with a prefix: its dark rules are selected by the root attribute, not an id
    const auto = await renderDiagram(make('auto'), {name: 'x.svg', budget: 'cacheOnly', idPrefix: 'q'});
    assert.match(auto.svg, /prefers-color-scheme: dark/);
    assert.match(auto.svg, /data-appearance="auto"/);
  } finally { closeMeasurer(); }
});
