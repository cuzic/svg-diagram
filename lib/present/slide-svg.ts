// A deck slide as one 1280 × 720 SVG with every text outlined (ADR 0056 D2): the blocks of lib/deck-layout.ts (the same places as the
// .pptx), the figure's own SVG nested where the layout puts it. Pure: the font comes in as a port (lib/svg-outline.ts), so the same code
// runs wherever a font can be handed in.
import {SLIDE_H, SLIDE_W, type Block, type DeckLayout, type TextBlock} from '../deck-layout.ts';
import {stripAutoBlock} from '../appearance-auto.ts';
import {prefixTagIds} from '../svg-ids.ts';
import {outlineText, type OutlineFont} from '../svg-outline.ts';
import type {TextBoxFn} from '../svg-geom.ts';

export interface SlideFigure {
  /** The figure's SVG as the renderer wrote it. */
  svg: string;
}
export interface SlideSvg {
  svg: string;
  /** Characters no font has a glyph for (drawn as the font's empty box), with the text they are in. */
  missing: {text: string; char: string}[];
  /** What some text asked for that outlines do not reproduce (a WordArt stroke, ...). */
  unsupported: string[];
  /** Emoji left as live text (no outline for them): the viewer's font draws them, at a width that may differ from the measured one. */
  liveEmoji: string[];
}

const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const n = (v: number): string => String(Math.round(v * 100) / 100);

/** One text block as <text> elements, a line each; the runs of a line one after the other. */
function textSvg(b: TextBlock, box: TextBoxFn): string {
  return b.lines.map((runs, i) => {
    const top = b.y + b.inset.y + i * b.pitch;
    const first = runs[0];
    if (!first) return '';
    // the baseline splits the pitch as the font's ascent and descent split its height (PowerPoint's exact line spacing does the same)
    const m = box('あ', 'sans', b.size, first.bold ? 700 : 400), base = top + b.pitch * m.ascent / (m.ascent + m.descent);
    // a centred line (a cover, ADR 0066) starts where its measured width leaves it in the middle of the box
    const lineW = b.align === 'center' ? runs.reduce((sum, r) => sum + box(r.text, 'sans', b.size, r.bold ? 700 : 400).w, 0) : 0;
    let x = b.x + b.inset.x + (b.align === 'center' ? (b.width - 2 * b.inset.x - lineW) / 2 : 0);
    return runs.map(r => {
      const weight = r.bold ? 700 : 400;
      const out = `<text x="${n(x)}" y="${n(base)}" font-family="sans-serif" font-size="${b.size}" font-weight="${weight}" fill="#${r.color}">${esc(r.text)}</text>`;
      x += box(r.text, 'sans', b.size, weight).w;
      return out;
    }).join('');
  }).join('');
}

const blockSvg = (b: Block, box: TextBoxFn): string => b.kind === 'text' ? textSvg(b, box)
  : `<rect x="${n(b.x)}" y="${n(b.y)}" width="${n(b.w)}" height="${n(b.h)}" fill="#${b.fill}"/>`;

/**
 * The figure's SVG as the content of a nested <svg> at `place`: no XML declaration, no <metadata>, and (ADR 0056 D2) the light side of an
 * `auto` figure, so a viewer's dark mode does not recolour the slide. A dark figure gets its page colour as a panel behind it, as on the .pptx.
 */
export function placedFigure(svg: string, place: {x: number; y: number; w: number; h: number}): string {
  const body = stripAutoBlock(svg.replace(/^\s*<\?xml[^>]*\?>\s*/, '')).replace(/<metadata\b[\s\S]*?<\/metadata>\s*/g, '');
  const open = /^<svg\b([^>]*)>/.exec(body);
  if (!open) throw new Error('slide: the figure is not an <svg>');
  const attrs = open[1] ?? '';
  const bg = /\sdata-appearance="dark"/.test(attrs) ? /\sdata-assumed-bg="(#[0-9a-fA-F]{6})"/.exec(attrs)?.[1] : undefined;
  // the figure keeps its viewBox; its own size, role and labels go (the slide is the image)
  const kept = attrs.replace(/\s(?:x|y|width|height|role|aria-labelledby|aria-label|data-[a-z-]+)="[^"]*"/g, '').replace(/\sxmlns="[^"]*"/, '');
  const panel = bg ? `<rect x="${n(place.x)}" y="${n(place.y)}" width="${n(place.w)}" height="${n(place.h)}" fill="${bg}"/>` : '';
  return `${panel}<svg${kept} x="${n(place.x)}" y="${n(place.y)}" width="${n(place.w)}" height="${n(place.h)}">${body.slice(open[0].length)}`;
}

/**
 * The slide: a white page, the heading and lead, the figure (or the columns' figures, captions and texts, ADR 0058), then the callouts and
 * source on top; all text outlined with `font`. `columns[j]` is column j's figure, where it has one.
 */
export function slideSvg(layout: DeckLayout, figure: SlideFigure | undefined, font: OutlineFont, box: TextBoxFn, columns: readonly (SlideFigure | undefined)[] = []): SlideSvg {
  const top = layout.top.map(b => blockSvg(b, box)).join('');
  const bottom = [...layout.bottom].reverse().map(g => g.map(b => blockSvg(b, box)).join('')).join('');
  const fig = figure && layout.figure ? placedFigure(figure.svg, layout.figure) : '';
  // two figures on one page would share ids (their markers, their titles): each column's get a prefix of their own (ADR 0012)
  const cols = layout.columns.map((c, j) => {
    const f = columns[j];
    return (f && c.figure ? placedFigure(prefixTagIds(f.svg, `c${j + 1}`), c.figure) : '') + [...(c.caption ? [c.caption] : []), ...c.text].map(b => blockSvg(b, box)).join('');
  }).join('');
  const raw = `<svg xmlns="http://www.w3.org/2000/svg" width="${SLIDE_W}" height="${SLIDE_H}" viewBox="0 0 ${SLIDE_W} ${SLIDE_H}"><rect width="${SLIDE_W}" height="${SLIDE_H}" fill="#ffffff"/>${top}${fig}${cols}${bottom}</svg>`;
  const o = outlineText(raw, font, box, {liveEmoji: true});
  const liveEmoji = [...o.svg.matchAll(/<text\b[^>]*>([^<]*)<\/text>/g)].map(m => m[1] ?? '');
  return {svg: o.svg, missing: o.missing, unsupported: o.unsupported, liveEmoji};
}

/** What the slide says, for `<img alt>` (ADR 0056 D2: the SVG's own <title> is not read out from an <img>). */
export function slideText(s: {title?: string; lead?: string; callouts?: readonly {label?: string; text: string}[]; source?: string; columns?: readonly {caption?: string; text?: string}[]; layout?: 'cover'; event?: string; date?: string; presenter?: string}, figureTitle?: string, columnTitles: readonly (string | undefined)[] = []): string {
  const cols = (s.columns ?? []).flatMap((c, j) => [c.caption, columnTitles[j], c.text]);
  // a cover's fields in the order they are seen (ADR 0066 D10)
  if (s.layout === 'cover') return [s.event, s.title, s.lead, s.date, s.presenter, s.source].filter((t): t is string => !!t).join('\n');
  return [s.title, s.lead, figureTitle, ...cols, ...(s.callouts ?? []).map(c => (c.label ?? '') + c.text), s.source].filter((t): t is string => !!t).join('\n');
}
