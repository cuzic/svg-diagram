// A deck's slides as outlined SVGs, for `serve` (ADR 0056 D2, D5): the figures drawn as `pptx-deck` draws them, the slide's text wrapped
// with the same measuring, everything placed by lib/deck-layout.ts and outlined with the project's font files (lib/font-metrics.ts).
import {createHash} from 'node:crypto';
import {deckTexts, planDeckLayout, roomMessage, smallTextWarning, type TextWidth} from '../deck-layout.ts';
import {figurePath, type DeckSlide} from '../deck-spec.ts';
import {renderDeckFigure, type LoadedDeck} from '../deck-load.ts';
import {measureAll, splitAtoms, textWidth} from '../measure.ts';
import {outlineFontFromFiles, textBox} from '../font-metrics.ts';
import {minTextPt, placeShapes} from '../pptx/deck.ts';
import {fontsOf, planSlide} from '../pptx/slide.ts';
import type {MeasureRequest} from '../types/core.ts';
import type {Config} from '../types/project.ts';
import {slideSvg, slideText} from './slide-svg.ts';
import {checkSlideSvg} from './svg-allow.ts';

export interface RenderedSlide {
  /** The slide's SVG, and its SHA-256 (hex): the slide's URL is /s/<hash>.svg. */
  svg: string;
  hash: string;
  /** What the slide says, for <img alt>. */
  text: string;
  title: string;
  notes: string;
}
export interface RenderedDeck {
  title: string;
  /** One per slide; null where the slide could not be drawn (its problems are in `errors`). */
  slides: (RenderedSlide | null)[];
  /** Problems, each with its place: a slide with one is not drawn. */
  errors: string[];
  warnings: string[];
}

const sha256 = (s: string): string => createHash('sha256').update(s).digest('hex');
const key = (atom: string, size: number, weight: number) => `${size}|${weight}|${atom}`;

/** A slide drawn before, and what it was warned about (each warning without its `slides[i]` place, which is added for where it is now). */
export interface CachedSlide {slide: Omit<RenderedSlide, 'notes'>; warnings: {figure: boolean; text: string}[]}
/** Drawn slides kept by what they were drawn from, so a save redraws only the slides it changed (ADR 0056 D5). */
export type SlideCache = Map<string, CachedSlide>;

/**
 * Every slide of `loaded` drawn. `fresh`: re-read the .ts figures (a watcher). `cache`: slides drawn before, by their input; a slide with a
 * spec figure or none is taken from it when its input (all but the notes), the project's settings and `fontStamp` are the same. A slide
 * whose figure is a .ts source is always drawn (what it imports is not in the key). The cache keeps only this deck's slides afterwards.
 */
export async function renderDeck(loaded: LoadedDeck, cfg: Config, opts: {fresh?: boolean; cache?: SlideCache; fontStamp?: string} = {}): Promise<RenderedDeck> {
  const {deck, sources} = loaded;
  const errors: string[] = [], warnings: string[] = [];
  const cache = opts.cache, settings = JSON.stringify([cfg, opts.fontStamp ?? '']);
  const keys = deck.slides.map((s, i) => {
    if (!cache || sources.has(i)) return null;
    const {notes: _n, ...drawn} = s;
    return sha256(JSON.stringify([drawn, settings]));
  });
  const hit = keys.map(k => (k && cache?.get(k)) || null);
  const figures = await Promise.all(deck.slides.map(async (s, i) => {
    const source = sources.get(i);
    if (hit[i] || (s.figure === undefined && !source)) return undefined;
    const r = await renderDeckFigure(i, s, source, cfg, opts);
    if (!r.ok) { errors.push(...r.errors); return null; }
    const lo = r.result.laidOut;
    return {svg: r.result.svg, w: Math.max(96, lo.width), h: Math.max(96, lo.canvasHeight), title: lo.title ?? '', laidOut: lo, warnings: r.result.verdict.warnings};
  }));
  // the slide's own text is measured as `pptx-deck` measures it: in one batch, by atoms (only the slides to draw)
  const requests = new Map<string, MeasureRequest>();
  deck.slides.forEach((s, i) => { if (!hit[i]) for (const t of deckTexts(s)) for (const atom of splitAtoms(t.text)) requests.set(key(atom, t.size, t.bold ? 700 : 400), {text: atom, size: t.size, weight: t.bold ? 700 : 400}); });
  const measured = await measureAll(requests);
  const widthOf = (atom: string, size: number, weight: number): number => measured.get(key(atom, size, weight))?.w ?? atom.length * size;
  const width: TextWidth = (text, size, bold) => textWidth(widthOf, text, size, bold ? 700 : 400);
  const font = outlineFontFromFiles(cfg.fonts);
  const box = (t: string, family: Parameters<typeof textBox>[1], size: number, weight: number) => textBox(t, family, size, weight, cfg.fonts);
  const pptxFonts = fontsOf(undefined);
  const placed = (i: number, w: {figure: boolean; text: string}) => `${w.figure ? figurePath(i, '') : `slides[${i}]`}: ${w.text}`;
  const slides = deck.slides.map((s: DeckSlide, i): RenderedSlide | null => {
    const cached = hit[i];
    if (cached) { for (const w of cached.warnings) warnings.push(placed(i, w)); return {...cached.slide, notes: s.notes ?? ''}; }
    const f = figures[i];
    if (f === null) return null;
    const said: {figure: boolean; text: string}[] = (f?.warnings ?? []).map(text => ({figure: true, text}));
    const layout = planDeckLayout(s, f, width);
    if (layout.noRoom) { errors.push(`slides[${i}]: ${roomMessage(f !== undefined)}`); return null; }
    if (f && layout.figure) {
      // the smallest text after scaling, counted as the .pptx counts it (ADR 0056 D2: the same warning on both)
      const plan = planSlide(f.laidOut, pptxFonts), inner = /<\/p:grpSpPr>([\s\S]*)<\/p:spTree>/.exec(plan.xml)?.[1] ?? '';
      const w = smallTextWarning({scale: layout.figure.k, minTextPt: minTextPt(placeShapes(inner, layout.figure.k, 0, 0))});
      if (w) said.push({figure: true, text: w});
    }
    const out = slideSvg(layout, f ? {svg: f.svg} : undefined, font, box);
    const here = `slides[${i}]`;
    for (const m of out.missing) errors.push(`${here}: no font has a glyph for 「${m.char}」 (in 「${m.text}」): name a font that has it in .svg-diagram.json "fonts"`);
    for (const u of out.unsupported) errors.push(`${here}: text drawn with ${u} cannot be outlined, so the slide would lose it: take it out of the figure`);
    if (out.liveEmoji.length) said.push({figure: false, text: `emoji ${[...new Set(out.liveEmoji)].join(' ')} are left to the viewer's emoji font (no outline for them), so their width may differ from the measured one`});
    const allowed = checkSlideSvg(out.svg);
    if (!allowed.ok) for (const p of allowed.problems) errors.push(`${here}: the slide SVG has ${p.what} (${p.where})`);
    if (out.missing.length || out.unsupported.length || !allowed.ok) return null;
    for (const w of said) warnings.push(placed(i, w));
    const slide = {svg: out.svg, hash: sha256(out.svg), text: slideText(s, f?.title), title: s.title ?? f?.title ?? ''};
    const k = keys[i];
    if (k && cache) cache.set(k, {slide, warnings: said});
    return {...slide, notes: s.notes ?? ''};
  });
  if (cache) { const live = new Set(keys.filter((k): k is string => k !== null)); for (const k of cache.keys()) if (!live.has(k)) cache.delete(k); }
  return {title: deck.title ?? '', slides, errors, warnings};
}
