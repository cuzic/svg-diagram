import {xmlProblems} from './xml-check.ts';
import type {DiagramData} from './types/core.ts';
import type {LaidOutDiagram} from './types/index.ts';
import type {Verdict} from './types/verdicts.ts';

/** A pass over the band tree before layout (it may mutate and returns the tree to hand on). */
export interface PreLayoutStage {name: string; run(d: DiagramData): DiagramData}
/** A pass over the laid-out tree before it is verified and drawn. */
export interface PostLayoutStage {name: string; run(d: LaidOutDiagram): LaidOutDiagram}

export interface Emitted {svg: string; xml: string[]}

interface PipelineServices {
  preLayout: readonly PreLayoutStage[];
  postLayout: readonly PostLayoutStage[];
  verify: (diagram: LaidOutDiagram) => Verdict;
  emit: (diagram: LaidOutDiagram, opts: {reveal?: number; nodeIds?: boolean}) => string;
}

export function createPipeline(services: PipelineServices) {
  /** Run the pre-layout passes in order. */
  function runPreLayout(d: DiagramData): DiagramData {
    return services.preLayout.reduce((acc, s) => s.run(acc), d);
  }

  /** Run the post-layout passes in order. */
  function runPostLayout(laidOut: LaidOutDiagram): LaidOutDiagram {
    return services.postLayout.reduce((acc, s) => s.run(acc), laidOut);
  }

  /**
   * Pre-layout passes, then `layout` (the caller's: it owns the slide budget and the fill / font-scale search, which write into
   * the prepared tree before laying out), then the post-layout passes, then verify. Verify is last because it judges exactly what
   * emit will draw.
   */
  async function runChecked(d: DiagramData, layout: (prepared: DiagramData) => Promise<LaidOutDiagram>): Promise<{laidOut: LaidOutDiagram; verdict: Verdict}> {
    const laidOut = runPostLayout(await layout(runPreLayout(d)));
    return {laidOut, verdict: services.verify(laidOut)};
  }

  /** Emit the final drawing (`reveal`: the last stage when the diagram has click stages) and check the SVG is well-formed XML. */
  function emitOutputs(laidOut: LaidOutDiagram, opts: {reveal?: number; nodeIds?: boolean} = {}): Emitted {
    const emitOpts = opts.reveal ? {reveal: opts.reveal} : {};
    const svg = services.emit(laidOut, {...emitOpts, ...(opts.nodeIds ? {nodeIds: true} : {})});
    return {svg, xml: xmlProblems(svg)};
  }

  /** One reveal stage's SVG (stage 0 = nothing revealed yet), from the same laid-out tree as the final drawing. */
  function emitRevealStage(laidOut: LaidOutDiagram, stage: number, opts: {nodeIds?: boolean} = {}): string {
    return services.emit(laidOut, {reveal: stage, ...(opts.nodeIds ? {nodeIds: true} : {})});
  }

  return {runPreLayout, runPostLayout, runChecked, emitOutputs, emitRevealStage};
}
