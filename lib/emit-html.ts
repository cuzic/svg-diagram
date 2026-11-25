// Serializes a layoutDiagram() result into an HTML fragment: boxes, banners, group frames and every line of text are
// absolutely positioned elements styled by CSS; everything CSS cannot draw (connectors, arrowheads, tables, curves, wireframes …)
// is the SVG emit.ts already makes, laid over the same canvas in one inline <svg class="sd-ov">.
//
// Same geometry as the SVG: layout.ts has already broken every text into lines and placed each baseline, so a line is one element
// with white-space: pre — the browser never re-wraps it. A line's top is its baseline minus the font's ascent (its line-height is
// ascent + descent), which is how the baseline lands where the <text> of the SVG puts it.
import {toneEnv} from './tokens.ts';
import type {ToneEnv} from './tokens.ts';
import {emitSvg} from './emit.ts';
import {renderHtmlOverlay} from './html-overlay.ts';
import {visibleAt} from './reveal-visibility.ts';
import type {LaidOutDiagram, LaidOutBand} from './types/index.ts';
import {bannerHtml, boxHtml, captionHtml, gridHtml, groupHtml, htmlAdapterFor, rowHtml, tableHtml} from './html-native.ts';
import type {FontBox, HtmlAdapters} from './html-native.ts';
import {htmlDocument, stripSvg} from './html-document.ts';
import {must} from './must.ts';

export type {FontBox} from './html-native.ts';

const adapters = {
  banner: bannerHtml, box: boxHtml, caption: captionHtml, grid: gridHtml,
  group: groupHtml, row: rowHtml, table: tableHtml,
} satisfies HtmlAdapters;

type HtmlOptions = {reveal?: number; id?: string; fontBox: FontBox; emit?: (diagram: LaidOutDiagram, noRecolor: boolean) => string};

/** A self-contained HTML fragment (a <div> and a <style>) for the diagram. `id` scopes the CSS (default: a hash of the content, so the same figure always gets the same id and two figures do not share one). */
export function emitHtml(d: LaidOutDiagram, opts: HtmlOptions): string {
  return emitHtmlWith(d, toneEnv(d.tones), opts);
}
// the inner emitSvg calls share d.tones, so they resolve the same env (toneEnv caches it by the overrides object)
function emitHtmlWith(d: LaidOutDiagram, tones: ToneEnv, opts: HtmlOptions): string {
  const {day} = d, fb = opts.fontBox;
  const emit = opts.emit ?? ((figure, noRecolor) => emitSvg(figure, {reveal: opts.reveal, noRecolor}));
  const visible = d.laidOut.filter(b => visibleAt(b, opts.reveal));
  // The SVG draws the bands in order and the connectors on top; so does this: consecutive bands of one kind (drawn as HTML, as the SVG
  // of the emitter, or as the author's own raw SVG) are one piece, and the pieces go out in the order of the layout.
  // the shapes of a part stay SVG (as CSS where it can), its words are HTML; raw() is the author's SVG and stays whole
  const overlay = (bands: LaidOutBand[], connects: LaidOutDiagram['connects']): string =>
    renderHtmlOverlay(emit({...d, laidOut: bands, connects}, true), fb);
  // raw() is the author's SVG and wordart() is SVG-only art (outlines, turns, gradients, vertical glyphs: none of it is a CSS box): both stay whole
  const kindOf = (b: LaidOutBand) => htmlAdapterFor(adapters, b)?.accepts(b) ? 'html' : b.type === 'raw' || b.type === 'wordart' ? 'raw' : 'svg';
  let body = '';
  for (let i = 0; i < visible.length;) {
    const kind = kindOf(must(visible[i]));
    let j = i;
    while (j < visible.length && kindOf(must(visible[j])) === kind) j++;
    const run = visible.slice(i, j);
    if (kind === 'html') body += run.map(b => must(htmlAdapterFor(adapters, b)).render(b, day, tones, fb, d.roles, opts.reveal)).join('');
    else if (kind === 'raw') body += stripSvg(emit({...d, laidOut: run, connects: []}, true), 'sd-ov sd-raw');
    else body += overlay(run, []);
    i = j;
  }
  if (d.connects.some(c => visibleAt(c, opts.reveal))) body += overlay([], d.connects);
  return htmlDocument(d, tones, body, opts.id);
}
