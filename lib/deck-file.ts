// Read deck files and resolve figure paths before choosing a spec validator.
import fs from 'node:fs';
import path from 'node:path';
import {withCalloutObjects, type DeckSlide, type DeckSpec} from './deck-spec-core.ts';
import {withoutSchemaField, type SpecIssue} from './spec-kit.ts';

export interface LoadedDeck {
  deck: DeckSpec;
  /** The .ts figures: `figureKey(i)` (slide i's figure) or `figureKey(i, j)` (its column j) → the absolute path (the deck's `figure` is left out for these). */
  sources: Map<string, string>;
  /** Every file this read: the deck and the .json figures (the .ts figures are in `sources`). */
  files: string[];
}

type DeckFileError = {ok: false; errors: string[]};
export type LoadDeckResult = {ok: true; loaded: LoadedDeck} | DeckFileError;

/** The key of a figure in `sources`: slide i's own figure, or the figure of its column j (ADR 0058). */
export const figureKey = (i: number, j?: number): string => j === undefined ? String(i) : `${i}:${j}`;
/** Whether slide i has any .ts figure (its own or a column's). */
export const hasSource = (sources: ReadonlyMap<string, string>, i: number): boolean => sources.has(figureKey(i)) || [...sources.keys()].some(k => k.startsWith(`${i}:`));

const message = (e: unknown): string => e instanceof Error ? e.message : String(e);

/** Resolve figure paths and retain the input used for validation. */
export function readDeckFile(deckFile: string): DeckFileError | {ok: true; loaded: LoadedDeck; checked: unknown} {
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
  const resolved0 = Array.isArray(slides) ? {...(raw as object), slides: slides.map((s: unknown, i) => {
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
  const resolved = withCalloutObjects(resolved0);
  if (errors.length) return {ok: false, errors};
  // checked with a stand-in where a .ts figure was left out: a heading for a slide (a figure is enough), a text for a column
  const checked = Array.isArray((resolved as {slides?: unknown} | null)?.slides)
    ? {...(resolved as object), slides: (resolved as DeckSpec).slides.map((s, i) => s === null || typeof s !== 'object' ? s : ({
      ...(sources.has(figureKey(i)) && s.title === undefined ? {...s, title: '-'} : s),
      ...(Array.isArray(s.columns) ? {columns: s.columns.map((c, j) => sources.has(figureKey(i, j)) ? {...c, text: '-'} : c)} : {}),
    }))} : resolved;
  return {ok: true, loaded: {deck: resolved as DeckSpec, sources, files}, checked};
}


export function finishDeckFile(loaded: LoadedDeck, issues: readonly SpecIssue[]): LoadDeckResult {
  return issues.length ? {ok: false, errors: issues.map(x => `${x.path || '(deck)'}: ${x.message}`)} : {ok: true, loaded};
}
