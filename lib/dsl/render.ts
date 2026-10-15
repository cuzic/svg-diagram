import {layoutDiagram} from '../layout-measured.ts';
import {mapOf, checkTones} from '../tokens.ts';
import {analyzeFit} from '../fit.ts';
import {getSlideBudget, readSlideBudgetCache} from '../slide-budget.ts';
import {emitOutputs, runChecked} from '../pipeline.ts';
import {SLIDE_CANVAS, checkMinText, canvasFontScale, canvasRoles, ROLES, THEMES, scaleRoles} from '../tokens.ts';
import type {ConnectOpts} from '../types/containers.ts';
import type {BandInput, Diagram, DiagramData, DiagramOpts, Theme, Medium} from '../types/core.ts';
import type {LaidOutDiagram} from '../types/index.ts';
import type {RenderResult, CheckResult, SlideBudget} from '../types/verdicts.ts';
import type {DiagramInput} from '../strict.ts';
import {connect} from './connect.ts';
import {applyConnectDefaults, connectBand} from './defaults.ts';
import {fillScaleLimit} from './text-bands.ts';
import {contentBox} from '../layout-metrics.ts';
import {MathTooWideError} from '../math.ts';
import {applyWireframeDefaults} from './wireframe-numbering.ts';

//
// Compile time (lib/strict.ts): the result remembers the anchor ids add() has seen, so a connect() ref to an id
// that is declared neither in the same add() call (before OR after the connect) nor earlier in a chained
// `.add().add()` is a type error. Forward refs across separate add() calls are therefore rejected by the types
// although the runtime allows them; and in the statement style `d.add(x); d.add(connect(...))` (the result is not
// assigned back) the type cannot see the earlier ids, so a call that declares nothing is not checked.
// diagram({theme | day}) is required; fill: true requires `slide`. The runtime checks below are unchanged.
export function diagram(opts: DiagramInput): Diagram<never>;
export function diagram(opts: DiagramOpts = {}): Diagram {
  // `theme` (name from tokens.ts PALETTE) is the general form; `day` (1|2) is the
  // training deck's legacy spelling of the same thing. Stored as d.day internally.
  const theme = opts.theme ?? opts.day;
  if (!THEMES.map(String).includes(String(theme))) throw new Error(`diagram({theme}) must be one of ${THEMES.join(', ')} (or legacy day: 1|2)`);
  if (typeof opts.spotlight === 'object' && opts.spotlight.mutedOk !== undefined && typeof opts.spotlight.mutedOk !== 'boolean') throw new Error(`diagram({spotlight: {mutedOk}}) must be true or false (got ${String(opts.spotlight.mutedOk)})`);
  if (typeof opts.spotlight === 'object' && opts.spotlight.dim !== undefined && !['outline', 'fill'].includes(opts.spotlight.dim)) throw new Error(`diagram({spotlight: {dim}}) must be 'outline' or 'fill' (got ${String(opts.spotlight.dim)})`);
  if (opts.appearance !== undefined && !['light', 'dark'].includes(opts.appearance as string) && !(typeof opts.appearance === 'object' && opts.appearance && typeof opts.appearance.dark === 'object')) throw new Error(`diagram({appearance}) must be 'light', 'dark' or {dark: {bg, text, ...}} (got ${JSON.stringify(opts.appearance)})`);
  if (opts.wrap !== undefined && opts.wrap !== 'phrase' && opts.wrap !== 'char' && opts.wrap !== 'bunsetsu') throw new Error(`diagram({wrap}) must be 'phrase', 'char' or 'bunsetsu' (got ${JSON.stringify(opts.wrap)})`);
  mapOf(opts.appearance); // a custom dark set is validated here
  if (opts.sourceLine !== undefined && (typeof opts.sourceLine !== 'string' || !opts.sourceLine.trim() || /[\r\n]/.test(opts.sourceLine))) throw new Error('diagram({sourceLine}) must be a non-empty single-line string (e.g. "出典: 総務省 2025")');
  if (opts.status !== undefined && opts.status !== 'draft') throw new Error(`diagram({status}) must be 'draft' (got ${JSON.stringify(opts.status)})`);
  if (opts.statusLabel !== undefined && (opts.status === undefined || typeof opts.statusLabel !== 'string' || !opts.statusLabel.trim() || /[\r\n]/.test(opts.statusLabel))) throw new Error('diagram({statusLabel}) must be a non-empty single-line string and goes with diagram({status}) (e.g. "仮説")');
  if (opts.layoutCheck === 'strict' && (opts.medium ?? (opts.theme === undefined ? 'slide' : 'doc')) === 'slide') throw new Error("diagram({layoutCheck: 'strict'}) needs a document figure (theme: ...): slide figures (day: ...) are not given the layout-* checks, so it would never warn");
  if (opts.layoutCheck !== undefined && opts.layoutCheck !== 'info' && opts.layoutCheck !== 'strict') throw new Error(`diagram({layoutCheck}) must be 'info' or 'strict' (got ${JSON.stringify(opts.layoutCheck)})`);
  if (opts.tocCheck !== undefined && opts.tocCheck !== 'info' && opts.tocCheck !== 'strict') throw new Error(`diagram({tocCheck}) must be 'info' or 'strict' (got ${JSON.stringify(opts.tocCheck)})`);
  if (opts.maxWidth !== undefined && !(typeof opts.maxWidth === 'number' && Number.isFinite(opts.maxWidth) && opts.maxWidth > 0)) throw new Error(`diagram({maxWidth}) must be a positive number (got ${JSON.stringify(opts.maxWidth)})`);
  if (opts.legend !== undefined && opts.legend !== 'auto' && opts.legend !== false) throw new Error(`diagram({legend}) must be 'auto' or false (got ${JSON.stringify(opts.legend)})`);
  if (opts.canvas !== undefined && (opts.slide || opts.fill)) throw new Error('diagram({canvas}) is a whole slide drawn 1:1; it cannot be combined with `slide` / `fill` (those fit a figure into a measured slot of a Slidev slide)');
  if (opts.width !== undefined && opts.width !== 'fit' && !(typeof opts.width === 'number' && Number.isFinite(opts.width) && opts.width > 0)) throw new Error(`diagram({width}) must be a positive number or 'fit' (got ${JSON.stringify(opts.width)})`);
  if (opts.width === 'fit' && (opts.canvas !== undefined || opts.fill || opts.slide)) throw new Error("diagram({width: 'fit'}) is for a document figure: a `canvas` is drawn 1:1, and `fill` / `slide` fit a measured slot");
  if (opts.canvas !== undefined && opts.canvas !== 'slide' && opts.canvas.minText !== undefined) checkMinText(opts.canvas.minText, 'diagram({canvas: {minText}})');
  const canvas = opts.canvas === undefined ? undefined : {...SLIDE_CANVAS, ...(opts.canvas === 'slide' ? {} : opts.canvas)};
  const d: DiagramData = {
    day: theme as Theme,
    appearance: opts.appearance, transparent: opts.transparent,
    // 'slide' (legacy day: 1|2 diagrams) gets slide-fit warnings; 'doc' (theme: ...) does not.
    medium: (opts.medium ?? (opts.theme === undefined ? 'slide' : 'doc')) as Medium,
    title: opts.title, desc: opts.desc,            // exposed as the SVG's <title> / <desc> (doc medium)
    terms: opts.terms,
    accept: opts.accept, // {'rule-id': 'why this finding is fine'} — shown as info instead of a warning
    wrap: opts.wrap,
    tones: opts.tones === undefined ? undefined : checkTones(opts.tones, 'diagram({tones})'),
    legend: opts.legend, legendLabels: opts.legendLabels, // legend: 'auto' adds entries for every notation used but not listed
    width: opts.width === 'fit' ? 940 : opts.width ?? canvas?.width ?? 940,
    ...(opts.width === 'fit' ? {fitWidth: true} : {}),
    ...(opts.maxWidth === undefined ? {} : {maxWidth: opts.maxWidth}), // the doc-width threshold (not the layout width), the project's maxWidth is used only when this is left out
    canvas,
    pad: opts.pad ?? 20,
    gap: opts.gap ?? 16,
    maxDisplayHeight: opts.maxDisplayHeight, // slide room for the <img> (see fit.ts)
    minEffectiveFont: opts.minEffectiveFont,
    slide: opts.slide, // {page, heading}: measure the real budget from this slide (slide-budget.ts)
    connectDefaults: opts.connectDefaults, wireframeDefaults: opts.wireframeDefaults,
    spotlight: opts.spotlight,
    sourceLine: opts.sourceLine,
    ...(opts.status === undefined ? {} : {status: opts.status, ...(opts.statusLabel === undefined ? {} : {statusLabel: opts.statusLabel})}), // a figure without a status is unchanged
    layoutCheck: opts.layoutCheck, // check only: the severity of the layout-* findings; never reaches the drawing
    tocCheck: opts.tocCheck, // check only: the severity of the toc-* findings; never reaches the drawing
    fill: !!opts.fill, // fit-figure slide: build to the measured width/height, growing fonts to use the slack (see build())
    bands: [],
  };
  return {
    ...d,
    add(this: Diagram, ...bands: BandInput[]) {
      let flat = bands.flat();
      if (d.connectDefaults) flat = applyConnectDefaults(flat, d.connectDefaults);
      if (d.wireframeDefaults) flat = applyWireframeDefaults(flat, d.wireframeDefaults);
      d.bands.push(...flat);
      return this;
    },
    connect(this: Diagram, from: string, to: string, opts: ConnectOpts = {}) { return this.add(connectBand(from, to, opts)); },
    get bands() { return d.bands; },
  } as Diagram;
}
// Everything build() does short of the disk: layout (with the slide budget and the fill / font scale search), verification,
// the SVG, its XML well-formedness. It does not throw for a failed verification or a malformed SVG — it reports them in
// `verdict` and `xml`, so build() can refuse to write while `svg-diagram show` can still draw the picture and say what is wrong.
// (A define()/constructor/layout error still throws.) budget: 'measure' measures a slide that has no cached budget (starts the
// dev server, writes the cache); 'cacheOnly' reads the cache and falls back to the default sizes with a note.
export async function renderDiagram(input: Diagram, opts: {name: string; budget: 'measure' | 'cacheOnly'; html?: boolean}): Promise<RenderResult> {
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
  const emitted = emitOutputs(laidOut, {html: opts.html, reveal: d.maxReveal});
  return {svg: emitted.svg, ...(emitted.html !== undefined ? {html: emitted.html} : {}), laidOut, verdict, xml: emitted.xml, notes, width: laidOut.width, height: laidOut.canvasHeight, fit: analyzeFit(laidOut), budget: budget as SlideBudget | null, budgetSource: budgetSource as RenderResult['budgetSource'], fontScale: laidOut.fontScale};
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
  // same stages as renderDiagram (lib/pipeline.ts), minus the slide budget and the fill search
  return runChecked(detach(input), prepared => {
    // a canvas diagram is drawn at its font scale, so it is checked at that scale too
    const s = prepared.canvas ? canvasFontScale(prepared.canvas.minText) : 1;
    return layoutFitted(prepared, () => layoutDiagram(prepared.canvas ? {...prepared, pad: Math.round(prepared.pad * s), gap: Math.round(prepared.gap * s)} : prepared, prepared.canvas ? {roles: canvasRoles(s)} : {}));
  });
}

/**
 * The layout, and for diagram({width: 'fit'}) once more at the width the content needs (`d.width` is set to it). The content may re-flow as it
 * narrows, so up to 3 rounds; a round that does not fit is dropped. check and build both come through here, so they judge the same figure.
 */
async function layoutFitted(d: DiagramData, layout: () => Promise<LaidOutDiagram>): Promise<LaidOutDiagram> {
  let laidOut = await layout();
  for (let i = 0; d.fitWidth && i < 3; i++) {
    const next = fitWidthOf(laidOut.laidOut, d.pad);
    if (next === undefined || next >= d.width) break;
    const before = d.width;
    d.width = next;
    const again = await layout();
    const need = fitWidthOf(again.laidOut, d.pad);
    if (need !== undefined && need > next) { d.width = before; break; }
    laidOut = again;
  }
  return laidOut;
}

/** The width a figure needs: its content (titles and legends aside) plus the padding on both sides, on the 4px grid; undefined for no content. */
function fitWidthOf(bands: LaidOutDiagram['laidOut'], pad: number): number | undefined {
  const box = contentBox(bands, true);
  return box ? Math.max(320, Math.ceil((box.w + 2 * pad) / 4) * 4) : undefined;
}
