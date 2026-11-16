// ADR 0056 D3: lib/present/svg-allow.ts, the allowlist every slide SVG passes before it is saved or accepted by the Worker.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {register} from 'node:module';
import test from 'node:test';
import {loadConfig} from '../lib/config.ts';
import {loadDiagram} from '../lib/load-source.ts';
import {renderDiagram} from '../lib/dsl/render.ts';
import {closeMeasurer} from '../lib/measure.ts';
import {outlineText} from '../lib/svg-outline.ts';
import {withColorEmoji} from '../lib/emoji-color.ts';
import {checkSlideSvg, ALLOWED_ELEMENTS, ALLOWED_ATTRIBUTES} from '../lib/present/svg-allow.ts';
import {realEngine} from './helpers/text-engine.ts';

register(new URL('../lib/resolve-hook.ts', import.meta.url)); // the examples import 'svg-diagram'

const EXAMPLES = path.resolve(import.meta.dirname, '../examples');
const svgOf = (body: string, rootAttrs = '') => `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1280" height="720" viewBox="0 0 1280 720"${rootAttrs}>${body}</svg>`;
/** The problems of `svg` (it must fail), one "where: what" per line. */
const rejected = (svg: string): string => {
  const r = checkSlideSvg(svg);
  assert.equal(r.ok, false, `expected a problem in ${svg.slice(0, 200)}`);
  return r.ok ? '' : r.problems.map(p => `${p.where}: ${p.what}`).join('\n');
};

test('every example, rendered and outlined (live emoji, and color emoji when the font has them), passes', async () => {
  const engine = realEngine(), config = loadConfig();
  const started = performance.now();
  const failures: string[] = [];
  let n = 0;
  for (const f of fs.readdirSync(EXAMPLES).filter(f => f.endsWith('.ts')).sort()) {
    const d = await loadDiagram(path.join(EXAMPLES, f), config);
    const {svg} = await renderDiagram(d, {name: f.replace(/\.ts$/, '.svg'), budget: 'cacheOnly'});
    for (const form of new Set([svg, withColorEmoji(svg)])) {
      const r = checkSlideSvg(outlineText(form, engine.font, engine.textBox, {liveEmoji: true}).svg);
      if (!r.ok) failures.push(`${f}: ${r.problems.slice(0, 3).map(p => `${p.where}: ${p.what}`).join('; ')}`);
    }
    n++;
  }
  // appearance 'auto' keeps an @media block in its <style>
  const auto = await loadDiagram(path.join(EXAMPLES, 'dark-theme.ts'), config);
  auto.appearance = 'auto';
  const autoSvg = (await renderDiagram(auto, {name: 'auto.svg', budget: 'cacheOnly'})).svg;
  assert.match(autoSvg, /@media \(prefers-color-scheme: dark\)/);
  assert.deepEqual(checkSlideSvg(outlineText(autoSvg, engine.font, engine.textBox, {liveEmoji: true}).svg), {ok: true});
  await closeMeasurer();
  assert.deepEqual(failures, []);
  assert.ok(n >= 180, `${n} examples`);
  console.log(`# ${n} examples rendered, outlined and checked in ${Math.round(performance.now() - started)} ms`);
});

test('what the renderer draws passes: glyph defs, live emoji, a PNG band, gradients, markers, clips, a nested figure', () => {
  const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const svg = `<?xml version="1.0" encoding="UTF-8"?>\n<!-- slide 1 -->\n${svgOf(`<title id="t">見出し &amp; 図</title><defs><path id="sd-glyph-sr12" d="M0 0L10 10Z"/>
<linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#000" stop-opacity="0.5"/></linearGradient>
<marker id="dsl-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10z"/></marker>
<clipPath id="c"><rect width="10" height="10"/></clipPath><filter id="f"><feColorMatrix type="matrix" values="1 0 0 0 0"/></filter></defs>
<style>.mono { font-family: 'JetBrains Mono', monospace; } @media (prefers-color-scheme: dark) { [fill="#fff"] { fill: url(#g); } }</style>
<g fill="#222" role="img" aria-label="url(http://example.com) is text"><use href="#sd-glyph-sr12" transform="translate(10 20) scale(0.01 -0.01)"/></g>
<text x="0" y="10" font-size="20" font-family="'Noto Color Emoji', sans-serif" xml:space="preserve">😀</text>
<image x="0" y="0" width="100" height="100" preserveAspectRatio="none" href="data:image/png;base64,${png}"/>
<path d="M0 0H10" fill="url(#g)" marker-end="url(#dsl-arrow)" clip-path="url(#c)" filter="url('#f')" style="stroke: url(#g)"/>
<svg x="100" y="100" width="400" height="300" viewBox="0 0 800 600" data-appearance="light"><rect width="800" height="600" fill="#fff"/><![CDATA[ ]]></svg>`)}`;
  assert.deepEqual(checkSlideSvg(svg), {ok: true});
});

test('forbidden elements are refused with where they are', () => {
  assert.match(rejected(svgOf('<g><g id="x"><script>alert(1)</script></g></g>')), /^svg > g:nth\(1\) > g:nth\(1\)#x > script:nth\(1\) @\d+: <script> is not allowed: it runs script/);
  assert.match(rejected(svgOf('<foreignObject width="10" height="10"><div xmlns="http://www.w3.org/1999/xhtml">x</div></foreignObject>')), /<foreignObject> is not allowed: it embeds HTML[\s\S]*unknown element <div>/);
  assert.match(rejected(svgOf('<a href="#x"><rect/></a>')), /svg > a:nth\(1\) @\d+: <a> is not allowed/);
  assert.match(rejected(svgOf('<use href="#a"><set attributeName="href" to="javascript:alert(1)"/></use>')), /<set> is not allowed: it can change attributes such as href/);
  assert.match(rejected(svgOf('<rect><animate attributeName="x" values="0;1"/></rect>')), /<animate> is not allowed[\s\S]*unknown attribute attributeName/);
  for (const el of ['iframe', 'object', 'embed', 'audio', 'video', 'feImage']) assert.match(rejected(svgOf(`<${el}/>`)), new RegExp(`<${el}> is not allowed`));
  assert.match(rejected(svgOf('<blink/>')), /svg > blink:nth\(1\) @\d+: unknown element <blink>/);
  assert.match(rejected(svgOf('<html:div xmlns:html="http://www.w3.org/1999/xhtml"/>')), /namespaced element <html:div>[\s\S]*namespaced attribute xmlns:html/);
  assert.match(rejected('<g/>'), /the root element must be <svg>/);
});

test('event handlers, unknown and namespaced attributes are refused', () => {
  assert.match(rejected(svgOf('<rect/>', ' onload="alert(1)"')), /^svg @0: event handler attribute onload/);
  assert.match(rejected(svgOf('<rect id="r" OnClick="x"/>')), /svg > rect:nth\(1\)#r @\d+: event handler attribute OnClick/);
  assert.match(rejected(svgOf('<rect foo="1"/>')), /unknown attribute foo/);
  assert.match(rejected(svgOf('<rect xml:base="http://evil/"/>')), /namespaced attribute xml:base/);
  assert.match(rejected(svgOf('<rect ev:event="click" xmlns:ev="http://www.w3.org/2001/xml-events"/>')), /namespaced attribute ev:event/);
  assert.match(rejected('<svg xmlns="http://www.w3.org/1999/xhtml"/>'), /xmlns="http:\/\/www.w3.org\/1999\/xhtml" — must be http:\/\/www.w3.org\/2000\/svg/);
});

test('href: only #id, and PNG / JPEG data on <image>', () => {
  assert.match(rejected(svgOf('<image href="https://example.com/a.png"/>')), /svg > image:nth\(1\) @\d+: href="https:\/\/example.com\/a.png" — only "#id" or data:image/);
  assert.match(rejected(svgOf('<use xlink:href="javascript:alert(1)"/>')), /href="javascript:alert\(1\)"/);
  assert.match(rejected(svgOf('<use href="&#x6a;avascript:alert(1)"/>')), /href="javascript:alert\(1\)"/, 'references are decoded before the check');
  assert.match(rejected(svgOf('<image href="data:image/svg+xml;base64,PHN2Zy8+"/>')), /href="data:image\/svg\+xml/);
  assert.match(rejected(svgOf('<image href="data:image/png;base64,abc$"/>')), /not valid base64/);
  assert.match(rejected(svgOf('<use href="data:image/png;base64,AAAA"/>')), /data: URL is allowed on <image> only/);
  assert.match(rejected(svgOf('<use href="other.svg#a"/>')), /href="other.svg#a"/);
  assert.match(rejected(svgOf('<rect href="#a"/>')), /href is not allowed on <rect>/);
  assert.equal(checkSlideSvg(svgOf('<image href="data:image/jpeg;base64,/9j/4AAQ"/>')).ok, true);
});

test('CSS: no @import, no url() but #id, no escapes or functions that load', () => {
  assert.match(rejected(svgOf('<style>@import "https://evil/x.css";</style>')), /svg > style:nth\(1\) @\d+: CSS: @import is not allowed/);
  assert.match(rejected(svgOf('<style>&#64;import url(x.css);</style>')), /@import[\s\S]*url\(x.css\)/, 'references are decoded');
  assert.match(rejected(svgOf('<style><![CDATA[rect { fill: url(http://evil/p.svg#g) }]]></style>')), /CSS: url\(http:\/\/evil\/p.svg#g\) — only url\(#id\)/);
  assert.match(rejected(svgOf('<style>rect { background: image-set("x.png" 1x) }</style>')), /image-set\( is not allowed/);
  assert.match(rejected(svgOf('<style>rect { fill: u\\72l(x) }</style>')), /escapes/);
  assert.match(rejected(svgOf('<style>@font-face { src: local(x) }</style>')), /@font-face is not allowed/);
  assert.match(rejected(svgOf('<rect style="fill: url(https://evil/)"/>')), /style="": CSS: url\(https:\/\/evil\/\)/);
  assert.match(rejected(svgOf('<rect fill="url(#ok) url(x.svg#bad)"/>')), /fill: url\(x.svg#bad\) — only url\(#id\)/);
  assert.match(rejected(svgOf('<rect filter="url(&quot;data:image/svg+xml,x&quot;)"/>')), /filter: url\("data:image/);
  assert.match(rejected(svgOf('<style><rect/></style>')), /an element inside <style>/);
});

test('declarations, processing instructions and CDATA tricks are refused', () => {
  assert.match(rejected(`<!DOCTYPE svg [<!ENTITY x "<script>alert(1)</script>">]>${svgOf('<text>&x;</text>')}`), /\(document\) @0: declaration <!DOCTYPE> is not allowed/);
  assert.match(rejected(svgOf('<!ENTITY x "y">')), /svg @\d+: declaration <!ENTITY> is not allowed/);
  assert.match(rejected(svgOf('<?xml-stylesheet href="https://evil/x.css"?>')), /processing instruction <\?xml-stylesheet\?>/);
  assert.match(rejected(`\n<?xml version="1.0"?>${svgOf('')}`), /processing instruction <\?xml\?> is not allowed \(only the XML declaration, at the start\)/);
  assert.match(rejected(svgOf('<text><![CDATA[</text><script>alert(1)</script>]]></text>')), /CDATA containing "<"/);
  assert.match(rejected(svgOf('<text>&nbsp;</text>')), /malformed markup: an "&" that starts no valid/, 'no entities but the XML five');
});

test('comments may hide markup but cannot smuggle an element', () => {
  assert.deepEqual(checkSlideSvg(svgOf('<!-- <script>alert(1)</script> --><rect/>')), {ok: true}, 'a comment is inert');
  assert.match(rejected(svgOf('<!--> <script>alert(1)</script> -->')), /malformed markup: a comment containing "--" or starting with ">"/, 'HTML ends <!--> at once');
  assert.match(rejected(svgOf('<!-- a --!> <script>alert(1)</script> -->')), /comment containing "--"/);
  assert.match(rejected(svgOf('<!-- unterminated <script>alert(1)</script>')), /unterminated comment/);
  assert.match(rejected(svgOf('<rect title="--><script>"/>')), /malformed markup: "<" in the value of title/);
  assert.deepEqual(checkSlideSvg(svgOf('<rect id=\'1" onload="alert(1)\'/>')), {ok: true}, 'a quote of the other kind is part of the value: no attribute is made');
});

test('malformed markup is refused', () => {
  for (const [svg, what] of [
    [svgOf('<rect x=1/>'), /attribute x is not quoted/],
    [svgOf('<rect x="1"y="2"/>'), /unexpected "y=\\"2\\"\/>/],
    [svgOf('<rect x="1" x="2"/>'), /attribute x given twice/],
    [svgOf('<g><rect></g>'), /<\/g> closes <rect>/],
    [svgOf('<g>'), /<svg> is not closed|<\/svg> closes <g>/],
    [svgOf('<rect'), /<\/svg> closes|is not closed|unexpected/],
    [svgOf('< script>'), /"<" that starts no tag/],
    [`${svgOf('')}<svg/>`, /a second root element/],
    [`${svgOf('')}junk`, /text outside the root element/],
    [svgOf('<text>a\u0000b</text>'), /control character U\+0000/],
    [svgOf('<text>a]]>b</text>'), /"]]>" in text/],
    ['', /no root element/],
  ] as const) assert.match(rejected(svg), what);
  assert.match(rejected(svgOf('<g>hello</g>')), /text inside <g> is not allowed/);
});

test('a 4 MiB slide with a large base64 image is checked quickly', () => {
  const b64 = 'QUJD'.repeat(1024 * 1024); // 4 MiB of base64
  const svg = svgOf(`<rect width="10" height="10"/><image width="1280" height="720" href="data:image/jpeg;base64,${b64}"/>${'<use href="#a" transform="translate(1 2)"/>'.repeat(2000)}<path id="a" d="M0 0"/>`);
  const started = performance.now();
  assert.deepEqual(checkSlideSvg(svg), {ok: true});
  const ms = performance.now() - started;
  console.log(`# ${(svg.length / 1048576).toFixed(1)} MiB checked in ${ms.toFixed(1)} ms`);
  assert.ok(ms < 500, `${ms} ms`);
  assert.match(rejected(svg.replace('QUJD', 'QU$D')), /not valid base64/);
});

test('the lists name what the renderer emits', () => {
  for (const el of ['svg', 'g', 'path', 'use', 'image', 'text', 'tspan', 'style', 'linearGradient', 'clipPath', 'marker', 'title']) assert.ok((ALLOWED_ELEMENTS as readonly string[]).includes(el), el);
  for (const el of ['script', 'foreignObject', 'a', 'set', 'animate', 'feImage']) assert.ok(!(ALLOWED_ELEMENTS as readonly string[]).includes(el), el);
  assert.ok(!(ALLOWED_ATTRIBUTES as readonly string[]).some(a => /^on/i.test(a)));
});
