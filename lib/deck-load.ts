// Reading a deck file (ADR 0055) for the CLIs that draw one: `pptx-deck` and `serve` (ADR 0056 D1). A slide's `figure` may be a JSON
// spec, or the path of a diagram source (.ts) or of a spec file (.json), relative to the deck file. The deck is checked with lib/deck-spec.ts
// once the paths are read; each figure is then drawn as `build` draws a source.
import fs from 'node:fs';
import path from 'node:path';
import {applyConfig} from './config.ts';
import {loadDiagram} from './load-source.ts';
import {renderDiagram} from './dsl/render.ts';
import {specToDiagram, SpecError, withoutSchemaField} from './spec.ts';
import {columnFallbackWarning, columnFigurePath, columnSpec, figurePath, validateDeck, type DeckSlide, type DeckSpec} from './deck-spec.ts';
import {fillSearch, ruleIds, type DrawnFigure} from './deck-layout.ts';
import {formatBuildError} from './error-format.ts';
import type {Diagram} from './types/core.ts';
import type {Config} from './types/project.ts';
import type {RenderResult} from './types/verdicts.ts';

export interface LoadedDeck {
  deck: DeckSpec;
  /** The .ts figures: `figureKey(i)` (slide i's figure) or `figureKey(i, j)` (its column j) → the absolute path (the deck's `figure` is left out for these). */
  sources: Map<string, string>;
  /** Every file this read: the deck and the .json figures (the .ts figures are in `sources`). */
  files: string[];
}

/** The key of a figure in `sources`: slide i's own figure, or the figure of its column j (ADR 0058). */
export const figureKey = (i: number, j?: number): string => j === undefined ? String(i) : `${i}:${j}`;
/** Whether slide i has any .ts figure (its own or a column's). */
export const hasSource = (sources: ReadonlyMap<string, string>, i: number): boolean => sources.has(figureKey(i)) || [...sources.keys()].some(k => k.startsWith(`${i}:`));

const message = (e: unknown): string => e instanceof Error ? e.message : String(e);


/** The deck at `deckFile` with its figure paths read, or every problem with it (each with its place). */
export function loadDeck(deckFile: string): {ok: true; loaded: LoadedDeck} | {ok: false; errors: string[]} {
  const abs = path.resolve(deckFile), dir = path.dirname(abs), rel = path.relative(process.cwd(), abs), shown = rel && !rel.startsWith('..') ? rel : abs;
  const files = [abs];
  let raw: unknown;
  try { raw = withoutSchemaField(JSON.parse(fs.readFileSync(abs, 'utf8'))); } catch (e) { return {ok: false, errors: [`${shown}: ${message(e)}`]}; }
  const slides = (raw as {slides?: unknown} | null)?.slides;
  // a figure given as a path: a .json spec is read in place; a .ts source is drawn as it is (and left out of the deck). Returns what the
  // figure becomes: the spec, or undefined for a .ts (or a path that failed); `keep` is false when the field is to be dropped
  const sources = new Map<string, string>(), errors: string[] = [];
  const resolve = (f: unknown, where: string, key: string): {keep: boolean; value?: unknown} => {
    if (typeof f !== 'string') return {keep: true, value: f};
    const at = path.resolve(dir, f);
    if (f.endsWith('.ts')) { if (fs.existsSync(at)) sources.set(key, at); else errors.push(`${where}: ${f} does not exist`); return {keep: false}; }
    if (f.endsWith('.json')) {
      files.push(at);
      try { return {keep: true, value: withoutSchemaField(JSON.parse(fs.readFileSync(at, 'utf8')))}; }
      catch (e) { errors.push(`${where}: ${f}: ${message(e)}`); return {keep: false}; }
    }
    errors.push(`${where}: a path must name a diagram source (.ts) or a spec file (.json); otherwise write the spec itself`);
    return {keep: false};
  };
  const resolved = Array.isArray(slides) ? {...(raw as object), slides: slides.map((s: unknown, i) => {
    if (typeof s !== 'object' || s === null) return s;
    const {figure, columns, ...rest} = s as DeckSlide;
    const out: DeckSlide = {...rest};
    // a cover draws no figure (ADR 0066 D2): its figure is left as written, for validateDeck to say so (not read, so a bad path is not said first)
    if (figure !== undefined && rest.layout === 'cover') out.figure = figure;
    else if (figure !== undefined) { const r = resolve(figure, `slides[${i}].figure`, figureKey(i)); if (r.keep) out.figure = r.value; }
    if (columns !== undefined) out.columns = Array.isArray(columns) ? columns.map((c, j) => {
      if (typeof c !== 'object' || c === null || c.figure === undefined) return c;
      const {figure: cf, ...crest} = c, r = resolve(cf, `slides[${i}].columns[${j}].figure`, figureKey(i, j));
      return r.keep ? {...crest, figure: r.value} : crest;
    }) : columns;
    return out;
  })} : raw;
  if (errors.length) return {ok: false, errors};
  // checked with a stand-in where a .ts figure was left out: a heading for a slide (a figure is enough), a text for a column
  const checked = Array.isArray((resolved as {slides?: unknown}).slides)
    ? {...(resolved as object), slides: (resolved as DeckSpec).slides.map((s, i) => ({
      ...(sources.has(figureKey(i)) && s.title === undefined ? {...s, title: '-'} : s),
      ...(Array.isArray(s.columns) ? {columns: s.columns.map((c, j) => sources.has(figureKey(i, j)) ? {...c, text: '-'} : c)} : {}),
    }))} : resolved;
  const issues = validateDeck(checked);
  if (issues.length) return {ok: false, errors: issues.map(x => `${x.path || '(deck)'}: ${x.message}`)};
  return {ok: true, loaded: {deck: resolved as DeckSpec, sources, files}};
}

/**
 * A figure drawn (a .ts source from `source`, else the spec `spec`), or the problems with it, each with its place: slide i's figure, or
 * with `column` the figure of its column j. With `columnPx` (the column's width), a spec that gives no width of its own is laid out at the
 * column's width; when it does not fit there, it is drawn at the document's width and `fallback` says so (ADR 0059).
 */
export async function renderDeckFigure(i: number, spec: unknown, source: string | undefined, cfg: Config, opts: {fresh?: boolean; column?: number; columnPx?: number; fill?: {box: {w: number; h: number}; cap: number}} = {}): Promise<{ok: true; result: RenderResult; fallback?: string} | {ok: false; errors: string[]}> {
  const j = opts.column, at = (p: string | null) => j === undefined ? figurePath(i, p) : columnFigurePath(i, j, p);
  const draw = async (s: unknown): Promise<{ok: true; result: RenderResult} | {ok: false; errors: string[]; why: string}> => {
    try {
      const d: Diagram = source ? await loadDiagram(source, cfg, opts) : applyConfig(specToDiagram(s), cfg);
      return {ok: true, result: await renderDiagram(d, {name: `slide${i + 1}${j === undefined ? '' : `-${j + 1}`}.svg`, budget: 'cacheOnly'})};
    } catch (e) {
      if (e instanceof SpecError) return {ok: false, errors: e.issues.map(x => `${at(x.path)}: ${x.message}`), why: e.issues[0]?.message ?? ''};
      return {ok: false, errors: [formatBuildError(source ?? at(''), e)], why: e instanceof Error ? e.message : String(e)};
    }
  };
  // 'fill' (ADR 0060): a spec that gives no width of its own is laid out at the width that draws it largest in its room
  if (opts.fill && !source && typeof spec === 'object' && spec !== null && !Array.isArray(spec) && (spec as {width?: unknown}).width === undefined) {
    let errors: string[] = [];
    const found = await fillSearch(opts.fill.box, opts.fill.cap, async width => {
      const r = await draw(width === null ? spec : {...spec, width});
      if (!r.ok) { if (width === null) errors = r.errors; return {ok: false, why: r.why}; }
      return {ok: true, w: Math.max(96, r.result.laidOut.width), h: Math.max(96, r.result.laidOut.canvasHeight), value: r.result, flags: ruleIds([...r.result.verdict.warnings, ...r.result.verdict.problems])};
    });
    if (!found.ok) return {ok: false, errors};
    const said = j !== undefined && found.width === null && found.narrower ? columnFallbackWarning(found.narrower.width, found.narrower.why) : undefined;
    return {ok: true, result: found.value, ...(said ? {fallback: said} : {})};
  }
  const narrow = j !== undefined && !source && opts.columnPx !== undefined ? columnSpec(spec, opts.columnPx) : {spec, auto: null};
  const first = await draw(narrow.spec);
  if (first.ok || narrow.auto === null) return first.ok ? first : {ok: false, errors: first.errors};
  const wide = await draw(spec);
  return wide.ok ? {...wide, fallback: columnFallbackWarning(narrow.auto, first.why)} : {ok: false, errors: wide.errors};
}

/**
 * Column j's figure laid out at `width` for choosing the columns' shares (ADR 0061): a spec without a width of its own at that width; a spec
 * with one, or a .ts figure, only as it is (a narrower width "fails", so the search does not draw the same figure again).
 */
export async function drawColumnFigure(i: number, j: number, spec: unknown, source: string | undefined, cfg: Config, width: number | null, measureMinPt: (laidOut: RenderResult['laidOut']) => number | null, fresh?: boolean): Promise<DrawnFigure<RenderResult> & {errors?: string[]}> {
  const searchable = !source && typeof spec === 'object' && spec !== null && !Array.isArray(spec) && (spec as {width?: unknown}).width === undefined;
  if (width !== null && !searchable) return {ok: false, why: 'the figure has a width of its own'};
  const r = await renderDeckFigure(i, width === null ? spec : {...(spec as object), width}, source, cfg, {column: j, fresh});
  if (!r.ok) return {ok: false, why: r.errors[0] ?? '', errors: r.errors};
  const lo = r.result.laidOut;
  return {ok: true, w: Math.max(96, lo.width), h: Math.max(96, lo.canvasHeight), value: r.result, flags: ruleIds([...r.result.verdict.warnings, ...r.result.verdict.problems]), minPt: measureMinPt(lo)};
}
