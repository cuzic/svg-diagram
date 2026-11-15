// Reading a deck file (ADR 0055) for the CLIs that draw one: `pptx-deck` and `serve` (ADR 0056 D1). A slide's `figure` may be a JSON
// spec, or the path of a diagram source (.ts) or of a spec file (.json), relative to the deck file. The deck is checked with lib/deck-spec.ts
// once the paths are read; each figure is then drawn as `build` draws a source.
import fs from 'node:fs';
import path from 'node:path';
import {applyConfig} from './config.ts';
import {loadDiagram} from './load-source.ts';
import {renderDiagram} from './dsl/render.ts';
import {specToDiagram, SpecError} from './spec.ts';
import {figurePath, validateDeck, type DeckSlide, type DeckSpec} from './deck-spec.ts';
import {formatBuildError} from './error-format.ts';
import type {Diagram} from './types/core.ts';
import type {Config} from './types/project.ts';
import type {RenderResult} from './types/verdicts.ts';

export interface LoadedDeck {
  deck: DeckSpec;
  /** Slide index → the absolute path of its .ts figure (the deck's `figure` is left out for these). */
  sources: Map<number, string>;
  /** Every file this read: the deck and the .json figures (the .ts figures are in `sources`). */
  files: string[];
}

const message = (e: unknown): string => e instanceof Error ? e.message : String(e);

/** The deck at `deckFile` with its figure paths read, or every problem with it (each with its place). */
export function loadDeck(deckFile: string): {ok: true; loaded: LoadedDeck} | {ok: false; errors: string[]} {
  const abs = path.resolve(deckFile), dir = path.dirname(abs), rel = path.relative(process.cwd(), abs), shown = rel && !rel.startsWith('..') ? rel : abs;
  const files = [abs];
  let raw: unknown;
  try { raw = JSON.parse(fs.readFileSync(abs, 'utf8')); } catch (e) { return {ok: false, errors: [`${shown}: ${message(e)}`]}; }
  const slides = (raw as {slides?: unknown} | null)?.slides;
  // a figure given as a path: a .json spec is read in place; a .ts source is drawn as it is. The deck is checked with a .ts figure left out
  // (and a stand-in heading where the slide has none, as a figure is enough), and drawn from the slides as written
  const sources = new Map<number, string>(), errors: string[] = [];
  const resolved = Array.isArray(slides) ? {...(raw as object), slides: slides.map((s: unknown, i) => {
    const f = (s as DeckSlide | null)?.figure;
    if (typeof f !== 'string') return s;
    const at = path.resolve(dir, f), {figure: _f, ...rest} = s as DeckSlide;
    if (f.endsWith('.ts')) { if (fs.existsSync(at)) sources.set(i, at); else errors.push(`slides[${i}].figure: ${f} does not exist`); return rest; }
    if (f.endsWith('.json')) {
      files.push(at);
      try { return {...rest, figure: JSON.parse(fs.readFileSync(at, 'utf8')) as unknown}; }
      catch (e) { errors.push(`slides[${i}].figure: ${f}: ${message(e)}`); return rest; }
    }
    errors.push(`slides[${i}].figure: a path must name a diagram source (.ts) or a spec file (.json); otherwise write the spec itself`);
    return rest;
  })} : raw;
  if (errors.length) return {ok: false, errors};
  const checked = Array.isArray((resolved as {slides?: unknown}).slides)
    ? {...(resolved as object), slides: (resolved as DeckSpec).slides.map((s, i) => sources.has(i) && s.title === undefined ? {...s, title: '-'} : s)} : resolved;
  const issues = validateDeck(checked);
  if (issues.length) return {ok: false, errors: issues.map(x => `${x.path || '(deck)'}: ${x.message}`)};
  return {ok: true, loaded: {deck: resolved as DeckSpec, sources, files}};
}

/** Slide i's figure drawn (a .ts source from `source`, else the slide's spec), or the problems with it, each with its place. */
export async function renderDeckFigure(i: number, slide: DeckSlide, source: string | undefined, cfg: Config, opts: {fresh?: boolean} = {}): Promise<{ok: true; result: RenderResult} | {ok: false; errors: string[]}> {
  try {
    const d: Diagram = source ? await loadDiagram(source, cfg, opts) : applyConfig(specToDiagram(slide.figure), cfg);
    return {ok: true, result: await renderDiagram(d, {name: `slide${i + 1}.svg`, budget: 'cacheOnly'})};
  } catch (e) {
    if (e instanceof SpecError) return {ok: false, errors: e.issues.map(x => `${figurePath(i, x.path)}: ${x.message}`)};
    return {ok: false, errors: [formatBuildError(source ?? figurePath(i, ''), e)]};
  }
}
