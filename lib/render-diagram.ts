// Rendering a diagram: the passes (reveal, auto legend, slide budget, fill / canvas scale, layout, verify, emit) in order, and
// checkDiagram() for `svg-diagram check`. Shell code (ADR 0007 §4): it reads the slide-budget cache and measures through
// layout-measured.ts. The pure steps it calls live in the core files. dsl.ts re-exports renderDiagram / checkDiagram / fillScaleLimit.
import {layoutDiagram} from './layout-measured.ts';
import {emitSvg} from './emit.ts';
import {emitHtml} from './emit-html.ts';
import {htmlEnv} from './html-env.ts';
import {xmlProblems} from './xml-check.ts';
import {verifyDiagram} from './verify.ts';
import {applyAutoLegend, walkBands} from './rules.ts';
import {analyzeFit} from './fit.ts';
import {getSlideBudget, readSlideBudgetCache} from './slide-budget.ts';
import {applySpotlight} from './spotlight.ts';
import {prepareReveal} from './reveal.ts';
import {canvasFontScale, canvasRoles, ROLES, OPT_IN_TEXT_MAX, scaleRoles} from './tokens.ts';
import type {Band, CheckResult, Diagram, DiagramData, LaidOutDiagram, RenderResult, SlideBudget, Verdict} from './types.ts';

/**
 * The largest scale fill: true may try. 1.8 as ever, but an opted-in size (banner headlineRole, bars / plane labelRole)
 * is not scaled past OPT_IN_TEXT_MAX px: a 'display' headline stops at 1.28x, a 'stat' label (34px) never reaches it.
 * The usual roles (a stat({size: 'display'}) included) are not held back, so a diagram without these options scales as before.
 */
export function fillScaleLimit(bands: Band[]): number {
  const optIn = walkBands(bands).flatMap(b => b.type === 'banner' && b.headlineRole ? [ROLES[b.headlineRole]] : (b.type === 'bars' || b.type === 'plane') && b.labelRole ? [ROLES[b.labelRole]] : b.type === 'image' ? [b.labelRole, ...(b.marks ?? []).map(m => m.role), ...(b.labels ?? []).map(l => l.role)].flatMap(r => r ? [ROLES[r]] : []) : []);
  return Math.min(1.8, optIn.length ? OPT_IN_TEXT_MAX / Math.max(...optIn) : 1.8);
}

// Everything build() does short of the disk: layout (with the slide budget and the fill / font scale search), verification,
// the SVG, its XML well-formedness. It does not throw for a failed verification or a malformed SVG — it reports them in
// `verdict` and `xml`, so build() can refuse to write while `svg-diagram show` can still draw the picture and say what is wrong.
// (A define()/constructor/layout error still throws.) budget: 'measure' measures a slide that has no cached budget (starts the
// dev server, writes the cache); 'cacheOnly' reads the cache and falls back to the default sizes with a note.
export async function renderDiagram(input: Diagram, opts: {name: string; budget: 'measure' | 'cacheOnly'; html?: boolean}): Promise<RenderResult> {
  const d = detach(input); // the passes below write into bands (reveal, legend items) and into d (width, ...): never into the caller's
  const maxReveal = prepareReveal(d);
  applyAutoLegend(d);
  const notes: string[] = [];
  // A diagram that names its slide gets a measured height budget and width
  // (cached) instead of fit.ts's defaults.
  let budget: SlideBudget | null = null;
  let budgetSource: RenderResult['budgetSource'] = null;
  if (d.slide) {
    const key = {...d.slide, svg: opts.name};
    if (opts.budget === 'measure') {
      budget = await getSlideBudget(key);
      budgetSource = budget.cached ? 'cache' : 'measured';
    } else {
      budget = readSlideBudgetCache(key);
      budgetSource = budget ? 'cache' : 'default';
      if (!budget) notes.push(`スライドの空き寸法が未計測(キャッシュなし)なので既定の寸法で描いた。\`svg-diagram build\` で一度実測すると正確になる`);
    }
    if (budget) {
      d.maxDisplayHeight = budget.maxHeight;
      d.usableWidth = budget.contentWidth;
    }
  }
  // fill: true (fit-figure slides) — the <img> is stretched to the slide's free
  // area, so draw for that area: canvas as wide as the slot, and the largest
  // font/pad/gap scale (>= 1) whose laid-out height still fits the slot's
  // height. Without this a short diagram leaves the slot half empty and its
  // 14px text is as small as it was at 940px wide.
  let fontScale = 1;
  let laidOut: LaidOutDiagram;
  let verdict: Verdict, svg: string, html: string | undefined;
  // Every scale is its own value (scaleRoles): measured with, laid out with and drawn with the same roles, which travel in the result.
  const layoutAt = async (s: number): Promise<LaidOutDiagram> => {
    const roles = d.canvas ? canvasRoles(s) : scaleRoles(ROLES, s);
    return layoutDiagram({...d, pad: Math.round(d.pad * s), gap: Math.round(d.gap * s)}, {roles});
  };
  if (d.fill && budget) {
    d.width = budget.contentWidth;
    let lo = 1, hi = fillScaleLimit(d.bands);
    if ((await layoutAt(1)).canvasHeight > budget.maxHeight) hi = 1; // doesn't even fit at 1x: report via fit warnings
    for (let i = 0; i < 7 && hi - lo > 0.01; i++) {
      const mid = (lo + hi) / 2;
      if ((await layoutAt(mid)).canvasHeight <= budget.maxHeight) lo = mid; else hi = mid;
    }
    fontScale = Math.floor(lo * 100) / 100;
  } else if (d.canvas) {
    // a whole-slide canvas is drawn 1:1, so everything is scaled until the smallest text is the canvas's minimum
    fontScale = canvasFontScale(d.canvas.minText);
  } else if (d.fill) {
    if (opts.budget === 'measure' || !d.slide) throw new Error('diagram({fill: true}) needs diagram({slide: {page, heading}}) to know the slot size');
    notes.push('fill: true の図はスライドの空き寸法が要るため、既定の幅・倍率で描いた');
  }
  laidOut = await layoutAt(fontScale);
  laidOut.fontScale = fontScale;
  applySpotlight(laidOut);
  verdict = verifyDiagram(laidOut);
  svg = emitSvg(laidOut, maxReveal ? {reveal: maxReveal} : {});
  if (opts.html) html = emitHtml(laidOut, htmlEnv, maxReveal ? {reveal: maxReveal} : {});
  return {svg, ...(html !== undefined ? {html} : {}), laidOut, verdict, xml: xmlProblems(svg), notes, width: laidOut.width, height: laidOut.canvasHeight, fit: analyzeFit(laidOut), budget, budgetSource, fontScale: laidOut.fontScale};
}

/** What the passes may write into: the bands are copied, so a band shared by two diagrams (or drawn twice) is never changed by a render. */
function detach<D extends DiagramData>(d: D): D {
  return {...d, bands: cloneData(d.bands)};
}
/**
 * A deep copy of plain data: arrays and plain objects (Object.prototype or null prototype) are copied; everything else is
 * shared — a function (a raw() band's draw), a string, a Map / Set / Date / RegExp, a class instance. (structuredClone throws
 * on raw()'s function; copying a class instance by hand breaks private fields and internal slots.) The same object met twice
 * is copied once, so a band placed in two spots stays one band in the copy, and a cycle ends.
 * Known gap: a class instance handed in as plan data (a point of plane({points})) is shared, so a reveal written into it by
 * prepareReveal can still show in another figure. Not copied: non-enumerable properties (the .left / .right / .at handles,
 * withAnchors' anchors) and symbol keys (NUMBERING, GIVEN, RICH) — add() has used them up and nothing downstream reads them.
 */
function cloneData<T>(v: T, seen = new WeakMap<object, unknown>()): T {
  if (!v || typeof v !== 'object') return v;
  if (seen.has(v)) return seen.get(v) as T;
  if (Array.isArray(v)) {
    const out: unknown[] = [];
    seen.set(v, out);
    for (const x of v) out.push(cloneData(x, seen));
    return out as T;
  }
  const proto = Object.getPrototypeOf(v);
  if (proto !== Object.prototype && proto !== null) return v;
  const out = Object.create(proto);
  seen.set(v, out);
  for (const [k, x] of Object.entries(v)) out[k] = cloneData(x, seen);
  return out;
}

// Layout + verification + rules, without writing any file: the engine behind `svg-diagram check`.
export async function checkDiagram(input: DiagramData): Promise<CheckResult> {
  const d = detach(input);
  prepareReveal(d);
  applyAutoLegend(d);
  // a canvas diagram is drawn at its font scale, so it is checked at that scale too
  const s = d.canvas ? canvasFontScale(d.canvas.minText) : 1;
  const laidOut = await layoutDiagram(d.canvas ? {...d, pad: Math.round(d.pad * s), gap: Math.round(d.gap * s)} : d, d.canvas ? {roles: canvasRoles(s)} : {});
  applySpotlight(laidOut);
  return {laidOut, verdict: verifyDiagram(laidOut)};
}
