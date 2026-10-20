// ADR 0018 unit B: the deck document is assembled from SVG strings. Checked by the document's structure — ids, references, the one
// <style> and its scoping, the CSP hashes, determinism — never by sizes or positions, which depend on the machine's fonts.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {buildDeck, svgTitle, externalRefs, slideHashName} from '../lib/deck-html.ts';
import type {DeckSlide} from '../lib/deck-html.ts';

const OUT = path.resolve(import.meta.dirname, '../examples/out');
const svgOf = (name: string) => fs.readFileSync(path.join(OUT, `${name}.svg`), 'utf8');
const slides = (): DeckSlide[] => ['arrow-weight', 'bars', 'bpmn'].map(name => ({name, svg: svgOf(name)}));
// stand-ins for unit C's assets: the viewer CSS (with the `no-js` rule) and the script
const CSS = '.no-js .slide { display: block }\n#deck { margin: 0 }\n';
const JS = "document.documentElement.classList.remove('no-js');\n";
const OPTS = {css: CSS, js: JS, title: 'My deck'};

const idsOf = (html: string) => [...html.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]);
const blocks = (html: string, tag: string) => [...html.matchAll(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, 'g'))].map(m => m[1]);
const hash = (s: string) => `'sha256-${createHash('sha256').update(s, 'utf8').digest('base64')}'`;

test('the example SVGs the tests use have what the assembly must deal with', () => {
  for (const s of slides()) {
    assert.match(s.svg, /<style>/);
    assert.match(s.svg, /<metadata id="svg-diagram">/);
    assert.match(s.svg, /id="dsl-arrow"|id="svg-title"/);
  }
});

test('every id in the document is unique, also when the same figure is given twice', () => {
  const html = buildDeck([...slides(), {name: 'arrow-weight', svg: svgOf('arrow-weight')}], OPTS);
  const ids = idsOf(html);
  assert.ok(ids.length > 10);
  assert.deepEqual(ids.filter((id, i) => ids.indexOf(id) !== i), []);
  assert.ok(ids.includes('deck'));
  for (let n = 1; n <= 4; n++) assert.ok(ids.includes(`s${n}`));
  // ids inside a figure are `sN-<name>-…`
  assert.ok(ids.includes('s1-arrow-weight-dsl-arrow'));
  assert.ok(ids.includes('s4-arrow-weight-dsl-arrow'));
});

test('every url(#…), href="#…" and aria-labelledby points at an id that exists', () => {
  const html = buildDeck(slides(), OPTS);
  const ids = new Set(idsOf(html));
  const refs: string[] = [];
  for (const m of html.matchAll(/url\(#([^)]+)\)/g)) refs.push(m[1]!);
  for (const m of html.matchAll(/href="#([^"]+)"/g)) refs.push(m[1]!);
  for (const m of html.matchAll(/aria-(?:labelledby|describedby)="([^"]+)"/g)) refs.push(...m[1]!.split(/\s+/));
  assert.ok(refs.length > 0);
  assert.deepEqual(refs.filter(r => !ids.has(r)), []);
  assert.ok(html.includes('aria-labelledby="s1-arrow-weight-svg-title s1-arrow-weight-svg-desc"'));
});

test('no <style> stays in a figure: the document has exactly one, and its figure rules are scoped to their #sN, in the figures\' order', () => {
  const html = buildDeck(slides(), OPTS);
  const body = html.slice(html.indexOf('<main'));
  assert.doesNotMatch(body, /<style/);
  const styles = blocks(html, 'style');
  assert.equal(styles.length, 1);
  const css = styles[0];
  assert.ok(css!.startsWith(CSS), 'the viewer CSS comes first, untouched');
  const figure = css!.slice(CSS.length);
  const selectors = [...figure.matchAll(/(?:^|\})\s*([^{}@]+)\{/g)].map(m => m[1]!.trim());
  assert.ok(selectors.length >= 3);
  for (const sel of selectors) for (const one of sel.split(',')) assert.match(one.trim(), /^#s[1-3] \S/, `scoped: ${one}`);
  assert.doesNotMatch(figure, /(^|\n)\s*text\s*\{/, 'no bare `text {` is left');
  const order = selectors.map(s => Number(/^#s(\d)/.exec(s)![1]));
  assert.deepEqual(order, [...order].sort(), 'the figures\' rules come in the figures\' order');
  assert.deepEqual([...new Set(order)], [1, 2, 3], 'each figure keeps its own rules');
});

test('no style attribute, no <metadata>, no source path or hash from the .svg input', () => {
  const html = buildDeck(slides(), OPTS);
  assert.doesNotMatch(html, /\sstyle="/);
  assert.doesNotMatch(html, /<metadata/);
  assert.doesNotMatch(html, /sourceSha256|toolVersion|examples\/arrow-weight\.ts/);
});

test('nothing external: no src=, no http(s) href, no @import, no url(http…)', () => {
  const html = buildDeck(slides(), OPTS);
  assert.doesNotMatch(html, /\ssrc\s*=/);
  assert.doesNotMatch(html, /href="https?:/i);
  assert.doesNotMatch(html, /@import/);
  assert.doesNotMatch(html, /url\(\s*['"]?https?:/i);
  for (const s of slides()) assert.deepEqual(externalRefs(s.svg), [], 'the example figures are self-contained');
});

test('externalRefs finds what is not self-contained and lets data URIs and fragments through', () => {
  assert.deepEqual(externalRefs('<svg><image href="data:image/png;base64,AAAA"/><use href="#a"/><use xlink:href="#b"/></svg>'), []);
  assert.deepEqual(externalRefs('<svg><image href="https://x.test/a.png"/></svg>'), ['https://x.test/a.png']);
  assert.deepEqual(externalRefs('<svg><style>@import url(https://x.test/f.css); .a { fill: url(//x.test/p) }</style></svg>').sort(), ['//x.test/p', 'https://x.test/f.css']);
});

test('--csp: one <style>, one <script>, and the policy carries exactly their SHA-256', () => {
  const html = buildDeck(slides(), {...OPTS, csp: true});
  const [style] = blocks(html, 'style'), [script] = blocks(html, 'script');
  assert.equal(blocks(html, 'style').length, 1);
  assert.equal(blocks(html, 'script').length, 1);
  const policy = /<meta http-equiv="Content-Security-Policy" content="([^"]+)">/.exec(html)?.[1];
  assert.ok(policy);
  assert.ok(policy.includes(`style-src ${hash(style!)};`));
  assert.ok(policy.includes(`script-src ${hash(script!)};`));
  assert.match(policy, /^default-src 'none'; /);
  assert.match(policy, /img-src data:$/);
  assert.equal(buildDeck(slides(), OPTS).includes('Content-Security-Policy'), false, 'without --csp there is no policy');
});

test('one <section> per input, each named "N / M: …", none hidden before the script runs; the no-js class is on <html>', () => {
  const input = slides();
  const html = buildDeck(input, OPTS);
  const sections = [...html.matchAll(/<section\b([^>]*)>/g)].map(m => m[1]);
  assert.equal(sections.length, input.length);
  sections.forEach((attrs, i) => {
    assert.match(attrs!, new RegExp(`id="s${i + 1}"`));
    assert.match(attrs!, new RegExp(`aria-label="${i + 1} / ${input.length}: [^"]+"`));
    assert.match(attrs!, /role="group" aria-roledescription="slide"/);
    assert.doesNotMatch(attrs!, /\bhidden\b/);
  });
  assert.match(html, /<html lang="ja" class="no-js">/);
  assert.match(html, /<main id="deck" tabindex="0" aria-label="My deck">/);
  assert.ok(blocks(html, 'style')[0]!.includes('.no-js .slide'));
  assert.equal(html.match(/<svg\b/g)!.length, input.length);
});

test('a slide is named by the title given, else the figure\'s <title>, else the source name', () => {
  const plain = '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 10 10"><rect width="10" height="10"/></svg>';
  const html = buildDeck([
    {name: 'given', svg: plain, title: 'A "quoted" <name>'},
    {name: 'titled', svg: svgOf('arrow-weight')},
    {name: 'bare name', svg: plain},
  ], OPTS);
  const labels = [...html.matchAll(/<section\b[^>]*aria-label="([^"]*)"/g)].map(m => m[1]);
  assert.equal(labels[0], '1 / 3: A &quot;quoted&quot; &lt;name>');
  assert.equal(labels[1], `2 / 3: ${svgTitle(svgOf('arrow-weight'))}`);
  assert.equal(labels[2], '3 / 3: bare name');
  assert.match(html, /data-name="bare-name"/);
  assert.equal(slideHashName('a b/c.d'), 'a-b-c.d');
});

test('the document is the same bytes on every call', () => {
  assert.equal(buildDeck(slides(), {...OPTS, csp: true, cols: 3}), buildDeck(slides(), {...OPTS, csp: true, cols: 3}));
});

test('a dark figure marks its slide; --cols is a custom property in the one <style>; @page comes from the figures', () => {
  const dark = svgOf('bars').replace(/^<svg /, '<svg data-appearance="dark" ');
  const html = buildDeck([{name: 'bars', svg: dark}, {name: 'bpmn', svg: svgOf('bpmn')}], {...OPTS, cols: 4});
  const sections = [...html.matchAll(/<section\b([^>]*)>/g)].map(m => m[1]);
  assert.match(sections[0]!, /class="slide slide-dark"/);
  assert.match(sections[1]!, /class="slide"/);
  const css = blocks(html, 'style')[0];
  assert.match(css!, /#deck \{ --deck-cols: 4 \}/);
  assert.match(css!, /@media print \{ @page \{ size: \d+(\.\d+)?px \d+(\.\d+)?px; margin: 0 \} \}/);
  assert.doesNotMatch(buildDeck(slides(), OPTS), /--deck-cols/);
});

test('an XML declaration is dropped; the viewer assets may not close their own block', () => {
  const html = buildDeck([{name: 'a', svg: `<?xml version="1.0"?>\n${svgOf('bars')}`}], OPTS);
  assert.doesNotMatch(html, /<\?xml/);
  assert.throws(() => buildDeck(slides(), {...OPTS, js: 'x</script><b>'}), /<\/script/);
  assert.throws(() => buildDeck(slides(), {...OPTS, css: 'x</style>'}), /<\/style/);
});

test('an empty deck is still a document', () => {
  const html = buildDeck([], OPTS);
  assert.match(html, /<main id="deck"/);
  assert.equal(html.match(/<section\b/g), null);
});
