// The render pipeline as data: the ordered passes renderDiagram / checkDiagram / finishBuild run, so the order (and why it is
// that order) lives in one place instead of in the call order of three functions. ADR 0007 has the history.
//
//   DiagramData --[pre-layout: band tree in, band tree out]--> layout --[post-layout: laid-out in, laid-out out]-->
//   verify --> emit (svg / html) --> xml check
//
// Behaviour note (ADR 0007): the pre-layout passes WRITE into the tree they are given (reveal stages, legend items, ...).
// The pipeline never copies; the caller hands it a detached tree (renderDiagram / checkDiagram call detach() first).

import {applyAutoLegend} from './rules.ts';
import {expandLoopBacks} from './loop-back.ts';
import {prepareReveal} from './reveal.ts';
import {applySpotlight} from './spotlight.ts';
import {verifyDiagram} from './verify.ts';
import {emitSvg} from './emit.ts';
import {emitHtml} from './emit-html.ts';
import {xmlProblems} from './xml-check.ts';
import type {DiagramData} from './types/core.ts';
import type {LaidOutDiagram} from './types/index.ts';
import type {Verdict} from './types/verdicts.ts';

/** A pass over the band tree before layout (it may mutate and returns the tree to hand on). */
export interface PreLayoutStage {name: string; run(d: DiagramData): DiagramData}
/** A pass over the laid-out tree before it is verified and drawn. */
export interface PostLayoutStage {name: string; run(d: LaidOutDiagram): LaidOutDiagram}

export const PRE_LAYOUT_STAGES: readonly PreLayoutStage[] = [
  // `loopBack` of a steps() / row / chevron becomes ordinary connect() bands right after it (ADR 0029 D4). It must run before reveal, because a
  // connector takes its reveal stage from the boxes it joins; and before layout, which lays the connectors out like any other.
  {name: 'loop-back', run: d => { d.bands = expandLoopBacks(d.bands); return d; }},
  // Resolves each band's / element's reveal and until by inheritance, and sets d.maxReveal / d.revealWarnings. It must run
  // before auto-legend (so legend items added later are not given stages) and before layout (layout reads the resolved stages
  // to keep every stage's geometry in one full layout).
  {name: 'reveal', run: d => { prepareReveal(d); return d; }},
  // Adds a legend band (or items to one) from the colours the bands use. It must precede layout, because the legend is a band
  // that takes space and is laid out like any other; after layout there is nothing left to add it to.
  {name: 'auto-legend', run: d => { applyAutoLegend(d); return d; }},
];

export const POST_LAYOUT_STAGES: readonly PostLayoutStage[] = [
  // Dims what is not in the spotlight: it needs laid-out rects (it is a geometry pass), and it must precede verify and emit
  // because both read the dimmed state (contrast is checked on what is drawn).
  {name: 'spotlight', run: d => { applySpotlight(d); return d; }},
];

/** Every stage in run order, layout / verify / emit / xml included: test/pipeline.test.ts pins it. */
export const PIPELINE_ORDER = [...PRE_LAYOUT_STAGES.map(s => s.name), 'layout', ...POST_LAYOUT_STAGES.map(s => s.name), 'verify', 'emit', 'xml'] as const;

/** Run the pre-layout passes in order. */
export function runPreLayout(d: DiagramData): DiagramData {
  return PRE_LAYOUT_STAGES.reduce((acc, s) => s.run(acc), d);
}

/** Run the post-layout passes in order. */
export function runPostLayout(laidOut: LaidOutDiagram): LaidOutDiagram {
  return POST_LAYOUT_STAGES.reduce((acc, s) => s.run(acc), laidOut);
}

/**
 * Pre-layout passes, then `layout` (the caller's: it owns the slide budget and the fill / font-scale search, which write into
 * the prepared tree before laying out), then the post-layout passes, then verify. Verify is last because it judges exactly what
 * emit will draw.
 */
export async function runChecked(d: DiagramData, layout: (prepared: DiagramData) => Promise<LaidOutDiagram>): Promise<{laidOut: LaidOutDiagram; verdict: Verdict}> {
  const laidOut = runPostLayout(await layout(runPreLayout(d)));
  return {laidOut, verdict: verifyDiagram(laidOut)};
}

export interface Emitted {svg: string; html?: string; xml: string[]}

/** Emit the final drawing (`reveal`: the last stage when the diagram has click stages) and check the SVG is well-formed XML. */
export function emitOutputs(laidOut: LaidOutDiagram, opts: {html?: boolean; reveal?: number} = {}): Emitted {
  const emitOpts = opts.reveal ? {reveal: opts.reveal} : {};
  const svg = emitSvg(laidOut, emitOpts);
  return {svg, ...(opts.html ? {html: emitHtml(laidOut, emitOpts)} : {}), xml: xmlProblems(svg)};
}

/** One reveal stage's SVG (stage 0 = nothing revealed yet), from the same laid-out tree as the final drawing. */
export function emitRevealStage(laidOut: LaidOutDiagram, stage: number): string {
  return emitSvg(laidOut, {reveal: stage});
}
