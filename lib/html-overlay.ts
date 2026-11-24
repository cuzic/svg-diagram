import type {FontBox} from './html-adapter.ts';
import {px, stripSvg} from './html-document.ts';
import {shapesToCss} from './svg-to-css.ts';
import {PALETTE} from './tokens.ts';

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

/** Turn the generated SVG overlay into positioned HTML text and CSS shapes where possible. */
export function renderHtmlOverlay(svg: string, fontBox: FontBox): string {
  const overlay = textsToHtml(fontBox, stripSvg(svg, 'sd-ov'));
  return shapesToCss(overlay.svg, 'sd-ov') + overlay.html;
}
