import {layoutDiagram} from '../layout-measured.ts';
import {mapOf, checkTones} from '../tokens.ts';
import {analyzeFit} from '../fit.ts';
import {getSlideBudget, readSlideBudgetCache} from '../slide-budget.ts';
import {emitOutputs, runChecked} from '../pipeline.ts';
import {SLIDE_CANVAS, canvasFontScale, canvasRoles, ROLES, THEMES, scaleRoles} from '../tokens.ts';
import type {BandInput, RenderResult, CheckResult, ConnectOpts, Diagram, DiagramData, DiagramOpts, LaidOutDiagram, SlideBudget, Theme, Medium} from '../types.ts';
import type {DiagramInput} from '../strict.ts';
import {connect} from './connect.ts';
import {applyConnectDefaults, connectBand} from './defaults.ts';
import {fillScaleLimit} from './text-bands.ts';
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
  if (opts.wrap !== undefined && opts.wrap !== 'phrase' && opts.wrap !== 'char') throw new Error(`diagram({wrap}) must be 'phrase' or 'char' (got ${JSON.stringify(opts.wrap)})`);
  mapOf(opts.appearance); // a custom dark set is validated here
  if (opts.sourceLine !== undefined && (typeof opts.sourceLine !== 'string' || !opts.sourceLine.trim() || /[\r\n]/.test(opts.sourceLine))) throw new Error('diagram({sourceLine}) must be a non-empty single-line string (e.g. "出典: 総務省 2025")');
  if (opts.legend !== undefined && opts.legend !== 'auto' && opts.legend !== false) throw new Error(`diagram({legend}) must be 'auto' or false (got ${JSON.stringify(opts.legend)})`);
  if (opts.canvas !== undefined && (opts.slide || opts.fill)) throw new Error('diagram({canvas}) is a whole slide drawn 1:1; it cannot be combined with `slide` / `fill` (those fit a figure into a measured slot of a Slidev slide)');
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
    width: opts.width ?? canvas?.width ?? 940,
    canvas,
    pad: opts.pad ?? 20,
    gap: opts.gap ?? 16,
    maxDisplayHeight: opts.maxDisplayHeight, // slide room for the <img> (see fit.ts)
    minEffectiveFont: opts.minEffectiveFont,
    slide: opts.slide, // {page, heading}: measure the real budget from this slide (slide-budget.ts)
    connectDefaults: opts.connectDefaults, wireframeDefaults: opts.wireframeDefaults,
    spotlight: opts.spotlight,
    sourceLine: opts.sourceLine,
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
    const laidOut = await layoutAt(fontScale);
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
    return layoutDiagram(prepared.canvas ? {...prepared, pad: Math.round(prepared.pad * s), gap: Math.round(prepared.gap * s)} : prepared, prepared.canvas ? {roles: canvasRoles(s)} : {});
  });
}
