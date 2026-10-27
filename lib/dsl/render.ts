import {layoutDiagram} from '../layout-measured.ts';
import {analyzeFit} from '../fit.ts';
import {getSlideBudget, readSlideBudgetCache} from '../slide-budget.ts';
import {emitOutputs, runChecked} from '../pipeline.ts';
import {fontBoxOf} from '../font-box.ts';
import {resolveImages} from '../image-file.ts';
import {canvasFontScale, canvasRoles, ROLES, scaleRoles} from '../tokens.ts';
import type {Diagram, DiagramData} from '../types/core.ts';
import type {LaidOutDiagram} from '../types/index.ts';
import type {RenderResult, CheckResult, SlideBudget} from '../types/verdicts.ts';
import {fillScaleLimit} from './text-bands.ts';
import {MathTooWideError} from '../math.ts';
import {walkBands} from '../rules.ts';
import {detachData, layoutFitted} from './diagram.ts';

/** detachData() plus the pictures image() left unread, read from the source's folder. */
function detach<D extends DiagramData>(d: D): D {
  const out = detachData(d);
  resolveImages(walkBands(out.bands), out.sourceDir ?? process.cwd());
  return out;
}
// Everything build() does short of the disk: layout (with the slide budget and the fill / font scale search), verification,
// the SVG, its XML well-formedness. It does not throw for a failed verification or a malformed SVG — it reports them in
// `verdict` and `xml`, so build() can refuse to write while `svg-diagram show` can still draw the picture and say what is wrong.
// (A define()/constructor/layout error still throws.) budget: 'measure' measures a slide that has no cached budget (starts the
// dev server, writes the cache); 'cacheOnly' reads the cache and falls back to the default sizes with a note.
export async function renderDiagram(input: Diagram, opts: {name: string; budget: 'measure' | 'cacheOnly'; html?: boolean; /** `data-node="id"` on the outline of each author-named node (ADR 0034) */ nodeIds?: boolean}): Promise<RenderResult> {
  const d = detach(input); // the passes below write into bands (reveal, legend items) and into d (width, ...): never into the caller's
  const notes: string[] = [];
  let budget: SlideBudget | null = null;
  let budgetSource: RenderResult['budgetSource'] = null;
  // pre-layout passes (reveal, auto-legend) -> layout (below) -> spotlight -> verify; see lib/pipeline.ts for why that order
  const {laidOut, verdict} = await runChecked(d, async (d): Promise<LaidOutDiagram> => {
    // A diagram that names its slide gets a measured height budget and width
    // (cached) instead of fit.ts's defaults.
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
    // Every scale is its own value (scaleRoles): measured with, laid out with and drawn with the same roles, which travel in the result.
    const layoutAt = async (s: number): Promise<LaidOutDiagram> => {
      const roles = d.canvas ? canvasRoles(s) : scaleRoles(ROLES, s);
      return layoutDiagram({...d, pad: Math.round(d.pad * s), gap: Math.round(d.gap * s)}, {roles});
    };
    if (d.fill && budget) {
      d.width = budget.contentWidth;
      // a formula is as wide as its size makes it: past some scale it no longer fits the column, which only means "too big" here (at 1x it still throws)
      const maxHeight = budget.maxHeight;
      const fits = async (s: number): Promise<boolean> => {
        try { return (await layoutAt(s)).canvasHeight <= maxHeight; } catch (e) { if (e instanceof MathTooWideError) return false; throw e; }
      };
      let lo = 1, hi = fillScaleLimit(d.bands);
      if ((await layoutAt(1)).canvasHeight > budget.maxHeight) hi = 1; // doesn't even fit at 1x: report via fit warnings
      for (let i = 0; i < 7 && hi - lo > 0.01; i++) {
        const mid = (lo + hi) / 2;
        if (await fits(mid)) lo = mid; else hi = mid;
      }
      fontScale = Math.floor(lo * 100) / 100;
    } else if (d.canvas) {
      // a whole-slide canvas is drawn 1:1, so everything is scaled until the smallest text is the canvas's minimum
      fontScale = canvasFontScale(d.canvas.minText);
    } else if (d.fill) {
      if (opts.budget === 'measure' || !d.slide) throw new Error('diagram({fill: true}) needs diagram({slide: {page, heading}}) to know the slot size');
      notes.push('fill: true の図はスライドの空き寸法が要るため、既定の幅・倍率で描いた');
    }
    const laidOut = await layoutFitted(d, () => layoutAt(fontScale));
    laidOut.fontScale = fontScale;
    return laidOut;
  });
  if (opts.html && d.appearance === 'auto') throw new Error("diagram({appearance: 'auto'}) is SVG only: the HTML form paints with style attributes, which a media rule cannot override (drop html / --html, or use 'dark')");
  const emitted = emitOutputs(laidOut, {html: opts.html, nodeIds: opts.nodeIds, reveal: d.maxReveal, ...(opts.html ? {fontBox: fontBoxOf(laidOut.measure)} : {})});
  return {svg: emitted.svg, ...(emitted.html !== undefined ? {html: emitted.html} : {}), laidOut, verdict, xml: emitted.xml, notes, width: laidOut.width, height: laidOut.canvasHeight, fit: analyzeFit(laidOut), budget: budget as SlideBudget | null, budgetSource: budgetSource as RenderResult['budgetSource'], fontScale: laidOut.fontScale};
}
// Layout + verification + rules, without writing any file: the engine behind `svg-diagram check`.
export async function checkDiagram(input: DiagramData): Promise<CheckResult> {
  // same stages as renderDiagram (lib/pipeline.ts), minus the slide budget and the fill search
  return runChecked(detach(input), prepared => {
    // a canvas diagram is drawn at its font scale, so it is checked at that scale too
    const s = prepared.canvas ? canvasFontScale(prepared.canvas.minText) : 1;
    return layoutFitted(prepared, () => layoutDiagram(prepared.canvas ? {...prepared, pad: Math.round(prepared.pad * s), gap: Math.round(prepared.gap * s)} : prepared, prepared.canvas ? {roles: canvasRoles(s)} : {}));
  });
}
