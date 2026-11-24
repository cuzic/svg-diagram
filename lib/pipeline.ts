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
import {createPipeline} from './pipeline-core.ts';
import type {PostLayoutStage, PreLayoutStage} from './pipeline-core.ts';

export type {Emitted, PostLayoutStage, PreLayoutStage} from './pipeline-core.ts';

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

export const {runPreLayout, runPostLayout, runChecked, emitOutputs, emitRevealStage} = createPipeline({
  preLayout: PRE_LAYOUT_STAGES,
  postLayout: POST_LAYOUT_STAGES,
  verify: verifyDiagram,
  emit: emitSvg,
});
