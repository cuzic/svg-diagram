// Serializes a layoutDiagram() result into an HTML fragment: boxes, banners, group frames and every line of text are
// absolutely positioned elements styled by CSS; everything CSS cannot draw (connectors, arrowheads, tables, curves, wireframes …)
// is the SVG emit.ts already makes, laid over the same canvas in one inline <svg class="sd-ov">.
//
// Same geometry as the SVG: layout.ts has already broken every text into lines and placed each baseline, so a line is one element
// with white-space: pre — the browser never re-wraps it. A line's top is its baseline minus the font's ascent (its line-height is
// ascent + descent), which is how the baseline lands where the <text> of the SVG puts it.
import {PALETTE, toneEnv} from './tokens.ts';
import type {ToneEnv} from './tokens.ts';
import {emitSvg} from './emit.ts';
import {shapesToCss} from './svg-to-css.ts';
import {visibleAt} from './reveal-visibility.ts';
import type {LaidOutDiagram, LaidOutBand} from './types/index.ts';
import {bannerHtml, boxHtml, captionHtml, gridHtml, groupHtml, htmlAdapterFor, rowHtml, tableHtml} from './html-native.ts';
import type {FontBox, HtmlAdapters} from './html-native.ts';
import {htmlDocument, px, stripSvg} from './html-document.ts';
import {must} from './must.ts';

export type {FontBox} from './html-native.ts';

const adapters = {
  banner: bannerHtml, box: boxHtml, caption: captionHtml, grid: gridHtml,
  group: groupHtml, row: rowHtml, table: tableHtml,
} satisfies HtmlAdapters;

// Every <text> the SVG emitter writes has the same few attributes (x, y = baseline, text-anchor, class, font-size, font-weight, fill) and
// at most <tspan>s for an emoji or a bold / coloured piece, so the text of any part can become the same absolutely placed line the native
// bands use. The shapes (lines, arrowheads, curves) stay SVG; the words are HTML, selectable and searchable.
const attrOf = (attrs: string, name: string): string | undefined => new RegExp(`(?:^|\\s)${name}="([^"]*)"`).exec(attrs)?.[1];

function textsToHtml(fb: FontBox, svg: string): {svg: string; html: string} {
  const out: string[] = [];
  const rest = svg.replace(/[ \t]*<text\b([^>]*)>([\s\S]*?)<\/text>\n?/g, (_m, attrs: string, inner: string) => {
    const size = Number(attrOf(attrs, 'font-size') ?? 16), weight = Number(attrOf(attrs, 'font-weight') ?? 400);
    const mono = attrOf(attrs, 'class') === 'mono', anchor = attrOf(attrs, 'text-anchor');
    const {ascent, descent} = fb(size, weight, mono);
    // SVG collapses runs of white space (and the line break after a tag); white-space: pre would keep them
    const content = inner.replace(/[ \t\r\n]+/g, ' ')
      .replace(/<tspan class="emoji">/g, '<span class="sd-e">')
      .replace(/<tspan font-weight="(\d+)"(?: fill="([^"]+)")?>/g, (_t, w: string, f?: string) => `<span style="font-weight:${w}${f ? `;color:${f}` : ''}">`)
      .replace(/<tspan fill="([^"]+)">/g, (_t, f: string) => `<span style="color:${f}">`)
      .replace(/<\/tspan>/g, '</span>');
    const cls = `sd-t${mono ? ' sd-m' : ''}${anchor === 'middle' ? ' sd-am' : anchor === 'end' ? ' sd-ae' : ''}`;
    out.push(`<div class="${cls}" style="left:${px(Number(attrOf(attrs, 'x')))};top:${px(Number(attrOf(attrs, 'y')) - ascent)};font-size:${size}px;font-weight:${weight};line-height:${ascent + descent}px;color:${attrOf(attrs, 'fill') ?? PALETTE.text}">${content}</div>`);
    return '';
  });
  return {svg: rest, html: out.join('')};
}

/** A self-contained HTML fragment (a <div> and a <style>) for the diagram. `id` scopes the CSS (default: a hash of the content, so the same figure always gets the same id and two figures do not share one). */
export function emitHtml(d: LaidOutDiagram, opts: {reveal?: number; id?: string; fontBox: FontBox}): string {
  return emitHtmlWith(d, toneEnv(d.tones), opts);
}
// the inner emitSvg calls share d.tones, so they resolve the same env (toneEnv caches it by the overrides object)
function emitHtmlWith(d: LaidOutDiagram, tones: ToneEnv, opts: {reveal?: number; id?: string; fontBox: FontBox}): string {
  const {day} = d, fb = opts.fontBox;
  const visible = d.laidOut.filter(b => visibleAt(b, opts.reveal));
  // The SVG draws the bands in order and the connectors on top; so does this: consecutive bands of one kind (drawn as HTML, as the SVG
  // of the emitter, or as the author's own raw SVG) are one piece, and the pieces go out in the order of the layout.
  // the shapes of a part stay SVG (as CSS where it can), its words are HTML; raw() is the author's SVG and stays whole
  const overlay = (bands: LaidOutBand[], connects: LaidOutDiagram['connects']): string => {
    const t = textsToHtml(fb, stripSvg(emitSvg({...d, laidOut: bands, connects}, {reveal: opts.reveal, noRecolor: true}), 'sd-ov'));
    return shapesToCss(t.svg, 'sd-ov') + t.html;
  };
  // raw() is the author's SVG and wordart() is SVG-only art (outlines, turns, gradients, vertical glyphs: none of it is a CSS box): both stay whole
  const kindOf = (b: LaidOutBand) => htmlAdapterFor(adapters, b)?.accepts(b) ? 'html' : b.type === 'raw' || b.type === 'wordart' ? 'raw' : 'svg';
  let body = '';
  for (let i = 0; i < visible.length;) {
    const kind = kindOf(must(visible[i]));
    let j = i;
    while (j < visible.length && kindOf(must(visible[j])) === kind) j++;
    const run = visible.slice(i, j);
    if (kind === 'html') body += run.map(b => must(htmlAdapterFor(adapters, b)).render(b, day, tones, fb, d.roles, opts.reveal)).join('');
    else if (kind === 'raw') body += stripSvg(emitSvg({...d, laidOut: run, connects: []}, {reveal: opts.reveal, noRecolor: true}), 'sd-ov sd-raw');
    else body += overlay(run, []);
    i = j;
  }
  if (d.connects.some(c => visibleAt(c, opts.reveal))) body += overlay([], d.connects);
  return htmlDocument(d, tones, body, opts.id);
}
