import {connectorSvgDefs, renderConnect} from './emit-connect.ts';
import {legendSvgDefs} from './emit-legend.ts';
import {renderBand} from './emit-handlers.ts';
import {withNodeIds} from './emit-node-ids.ts';
import {emitSvgWith} from './emit-svg-core.ts';
import type {SvgBandDefs} from './emit-svg-core.ts';
import {withParts} from './parts.ts';
import {diagramTitle, diagramDesc} from './rules.ts';
import {spotlightDim} from './spotlight.ts';
import type {LaidOutBand, LaidOutDiagram} from './types/index.ts';
import type {WrappedRun} from './types/text-bands.ts';

export {resolveTextColor, resolveBoxStyle} from './emit-common.ts';
export type {BoxStyle} from './emit-common.ts';
export {renderFlowShape} from './emit-flow-shape.ts';

function defsNeeded(band: LaidOutBand): SvgBandDefs {
  const runs = 'wrappedRuns' in band ? band.wrappedRuns : 'children' in band ? band.children : [];
  const mono = runs.some(run => (run as WrappedRun).mono || ('wrappedRuns' in run && run.wrappedRuns?.some(r => r.mono)))
    || band.type === 'table' && band.rows.some(r => r.cells.some(c => c.mono && c.lines.length));
  const legend = band.type === 'legend' ? legendSvgDefs(band) : {};
  const arrow = band.type === 'row' && band.arrows.length > 0
    || !!legend.arrow
    || band.type === 'sequence' && band.steps.some(s => s.kind === 'self' || s.kind === 'msg' && s.arrow !== 'none')
    || band.type === 'cycle'
    || band.type === 'concentric' && band.primitives.some(p => p.k === 'path' && !!p.arrow);
  const strongArrow = !!legend.strongArrow;
  return {mono, arrow, strongArrow};
}

const services = {connectorDefs: connectorSvgDefs, defsNeeded, renderBand, renderConnect, diagramTitle, diagramDesc, spotlightDim};

/** `parts`: mark each part's elements with `data-part` (ADR 0054), for the PowerPoint export; nothing else changes. */
export function emitSvg(laidOutDiagram: LaidOutDiagram, opts: {reveal?: number; noRecolor?: boolean; nodeIds?: boolean; parts?: boolean} = {}): string {
  const named = opts.nodeIds ? withNodeIds(laidOutDiagram) : laidOutDiagram;
  return emitSvgWith(services, opts.parts ? withParts(named) : named, opts);
}
