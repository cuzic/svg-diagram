import {applyConfig} from './config.ts';
import {loadDiagram} from './load-source.ts';
import {renderDiagram} from './dsl/render.ts';
import {SpecError} from './spec-kit.ts';
import {columnFallbackWarning, columnFigurePath, columnSpec, figurePath} from './deck-spec-core.ts';
import {fillSearch, ruleIds, type DrawnFigure} from './deck-layout.ts';
import {formatBuildError} from './error-format.ts';
import type {Diagram} from './types/core.ts';
import type {Config} from './types/project.ts';
import type {RenderResult} from './types/verdicts.ts';

/**
 * A figure drawn (a .ts source from `source`, else the spec `spec`), or the problems with it, each with its place: slide i's figure, or
 * with `column` the figure of its column j. With `columnPx` (the column's width), a spec that gives no width of its own is laid out at the
 * column's width; when it does not fit there, it is drawn at the document's width and `fallback` says so (ADR 0059).
 */
export async function renderDeckFigure(i: number, spec: unknown, source: string | undefined, cfg: Config, opts: {fresh?: boolean; column?: number; columnPx?: number; fill?: {box: {w: number; h: number}; cap: number}} = {}): Promise<{ok: true; result: RenderResult; fallback?: string} | {ok: false; errors: string[]}> {
  const j = opts.column, at = (p: string | null) => j === undefined ? figurePath(i, p) : columnFigurePath(i, j, p);
  const draw = async (s: unknown): Promise<{ok: true; result: RenderResult} | {ok: false; errors: string[]; why: string}> => {
    try {
      const d: Diagram = source ? await loadDiagram(source, cfg, opts) : applyConfig((await import('./spec.ts')).specToDiagram(s), cfg);
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
