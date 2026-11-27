import {applyConfig} from './config.ts';
import {renderDeckSpec} from './deck-render-spec.ts';
import {SpecError} from './spec-kit.ts';
import {columnFallbackWarning, columnFigurePath, columnSpec, figurePath} from './deck-spec-core.ts';
import {DOC_LAYOUT_WIDTH, fillSearch, widenDiagram, ruleIds, type DrawnFigure} from './deck-layout.ts';
import {growFigure} from './deck-grow.ts';
import {askTextSize} from './flow-grow.ts';
import {formatBuildError} from './error-format.ts';
import type {Diagram} from './types/core.ts';
import type {Config} from './types/project.ts';
import type {RenderResult} from './types/verdicts.ts';

/** The diagram with larger labels asked of the parts that can use them (ADR 0085 D2); as it is without a size. */
const askedDiagram = (d: Diagram, size?: number): Diagram => { askTextSize(d.bands, size); return d; };

/** A figure drawn as a deck slide's figure is sized to its slot, not to a document's text column: `doc-width` does not apply to it. */
function forSlide(r: RenderResult): RenderResult {
  const v = r.verdict;
  if (!v.findings.some(f => f.rule === 'doc-width')) return r;
  return {...r, verdict: {...v, findings: v.findings.filter(f => f.rule !== 'doc-width'), warnings: v.warnings.filter(w => !w.startsWith('[doc-width] '))}};
}

/**
 * A figure drawn (a .ts source from `source`, else the spec `spec`), or the problems with it, each with its place: slide i's figure, or
 * with `column` the figure of its column j. With `columnPx` (the column's width), a spec that gives no width of its own is laid out at the
 * column's width; when it does not fit there, it is drawn at the document's width and `fallback` says so (ADR 0059).
 */
export async function renderDeckFigure(i: number, spec: unknown, source: string | undefined, cfg: Config, opts: {fresh?: boolean; column?: number; columnPx?: number; fill?: {box: {w: number; h: number}; cap: number}; /** ADR 0085 D2: the slide's room for this figure, to draw its labels larger when that makes them larger on the slide (also when it is not 'fill'). */ grow?: {box: {w: number; h: number}; cap: number}; /** ADR 0085 D2: draw the labels of the parts that can use it up to this size (the second drawing). */ textSize?: number} = {}): Promise<{ok: true; result: RenderResult; fallback?: string} | {ok: false; errors: string[]}> {
  const j = opts.column, at = (p: string | null) => j === undefined ? figurePath(i, p) : columnFigurePath(i, j, p);
  const draw = async (s: unknown, wide?: number, textSize?: number): Promise<{ok: true; result: RenderResult} | {ok: false; errors: string[]; why: string}> => {
    try {
      if (!source) {
        const selected = await renderDeckSpec(s, cfg, wide, textSize);
        if (selected) return {ok: true, result: forSlide(selected)};
      }
      const {renderDiagram} = await import('./dsl/render.ts');
      const d: Diagram = source ? await (await import('./load-source.ts')).loadDiagram(source, cfg, opts)
        : applyConfig(askedDiagram(widenDiagram((await import('./spec.ts')).specToDiagram(s), wide), textSize), cfg);
      return {ok: true, result: forSlide(await renderDiagram(d, {name: `slide${i + 1}${j === undefined ? '' : `-${j + 1}`}.svg`, budget: 'cacheOnly'}))};
    } catch (e) {
      if (e instanceof SpecError) return {ok: false, errors: e.issues.map(x => `${at(x.path)}: ${x.message}`), why: e.issues[0]?.message ?? ''};
      return {ok: false, errors: [formatBuildError(source ?? at(''), e)], why: e instanceof Error ? e.message : String(e)};
    }
  };
  /** ADR 0085 D2: `result` (drawn at layout width `at`, or the spec's own) drawn again with larger labels when that comes out larger on the slide. */
  const grown = async (s: unknown, result: RenderResult, room: {box: {w: number; h: number}; cap: number} | undefined, at: number | undefined): Promise<RenderResult> => {
    if (source || !room) return result;
    const flags = ruleIds([...result.verdict.warnings, ...result.verdict.problems]);
    const box = (r: RenderResult) => ({w: Math.max(96, r.laidOut.width), h: Math.max(96, r.laidOut.canvasHeight)});
    const out = await growFigure(s, {...box(result), r: result}, room.box, room.cap, async size => {
      const again = await draw(at === undefined || at > DOC_LAYOUT_WIDTH ? s : {...(s as object), width: at}, at !== undefined && at > DOC_LAYOUT_WIDTH ? at : undefined, size);
      if (!again.ok || again.result.verdict.problems.length || ruleIds([...again.result.verdict.warnings, ...again.result.verdict.problems]).some(f => !flags.includes(f))) return null;
      return {...box(again.result), r: again.result};
    });
    return out.r;
  };
  // 'fill' (ADR 0060): a spec that gives no width of its own is laid out at the width that draws it largest in its room
  if (opts.fill && !source && typeof spec === 'object' && spec !== null && !Array.isArray(spec) && (spec as {width?: unknown}).width === undefined) {
    let errors: string[] = [];
    const found = await fillSearch(opts.fill.box, opts.fill.cap, async width => {
      const r = await (width === null ? draw(spec) : width > DOC_LAYOUT_WIDTH ? draw(spec, width) : draw({...spec, width}));
      if (!r.ok) { if (width === null || width > DOC_LAYOUT_WIDTH) errors = r.errors; // the widest width tried names what the slide could not hold (B6)
         return {ok: false, why: r.why}; }
      return {ok: true, w: Math.max(96, r.result.laidOut.width), h: Math.max(96, r.result.laidOut.canvasHeight), value: r.result, flags: ruleIds([...r.result.verdict.warnings, ...r.result.verdict.problems])};
    });
    if (!found.ok) return {ok: false, errors};
    const said = j !== undefined && found.width === null && found.narrower ? columnFallbackWarning(found.narrower.width, found.narrower.why) : undefined;
    const result = await grown(spec, found.value, opts.fill, found.width === null ? undefined : found.width);
    return {ok: true, result, ...(said ? {fallback: said} : {})};
  }
  const narrow = j !== undefined && !source && opts.columnPx !== undefined ? columnSpec(spec, opts.columnPx) : {spec, auto: null};
  const first = await draw(narrow.spec, undefined, opts.textSize);
  if (narrow.auto === null) return first.ok ? {ok: true, result: await grown(narrow.spec, first.result, opts.grow, undefined)} : {ok: false, errors: first.errors};
  // a problem that only the deck's own choice of width brings is like a spec error at that width: draw at the document's width and say so (ADR 0059 D3, never an error)
  const firstProblem = first.ok ? first.result.verdict.problems[0] : undefined;
  if (first.ok && firstProblem === undefined) return first;
  const wide = await draw(spec);
  if (!wide.ok) return {ok: false, errors: wide.errors};
  // both have problems: report the figure's own (at the width it would have without the column)
  return {...wide, fallback: columnFallbackWarning(narrow.auto, first.ok ? firstProblem as string : first.why)};
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

/**
 * A column's figure that `chooseColumns` drew (ADR 0061), drawn again at the same layout width with larger labels when that makes its text
 * larger on the slide (ADR 0085 D2). `room`: the column's room once the shares are chosen.
 */
export async function growColumnFigure(i: number, j: number, spec: unknown, source: string | undefined, cfg: Config, drawn: RenderResult, room: {w: number; h: number} | null, cap: number, fresh?: boolean): Promise<RenderResult> {
  if (source) return drawn;
  const flags = ruleIds([...drawn.verdict.warnings, ...drawn.verdict.problems]);
  const box = (r: RenderResult) => ({w: Math.max(96, r.laidOut.width), h: Math.max(96, r.laidOut.canvasHeight)});
  const out = await growFigure(spec, {...box(drawn), r: drawn}, room, cap, async size => {
    const again = await renderDeckFigure(i, {...(spec as object), width: drawn.laidOut.width}, undefined, cfg, {column: j, fresh, textSize: size});
    if (!again.ok || again.result.verdict.problems.length || ruleIds([...again.result.verdict.warnings, ...again.result.verdict.problems]).some(f => !flags.includes(f))) return null;
    return {...box(again.result), r: again.result};
  });
  return out.r;
}
