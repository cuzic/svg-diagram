import {connectorSvgDefs, renderConnect} from './emit-connect.ts';
import type {BandDef} from './band-def.ts';
import {definitionsOf} from './figure-definitions.ts';
import {spotlighter} from './spotlight-core.ts';
import {colorOf} from './tokens.ts';
import type {ToneEnv} from './tokens.ts';
import type {Roles, Theme} from './types/core.ts';
import {withNodeIds} from './emit-node-ids.ts';
import {emitSvgWith} from './emit-svg-core.ts';
import type {SvgBandDefs} from './emit-svg-core.ts';
import {withParts} from './parts.ts';
import {diagramTitle, diagramDesc} from './rules.ts';
import {spotlightDim} from './emit-spotlight.ts';
import type {LaidOutBand, LaidOutDiagram} from './types/index.ts';

export {resolveTextColor, resolveBoxStyle} from './emit-common.ts';
export type {BoxStyle} from './emit-common.ts';
export {renderFlowShape} from './emit-flow-shape.ts';

type DefinitionOf = (band: LaidOutBand) => BandDef | undefined;

// A placed band is drawn by the definition of its type.
export const renderBandWith = (definitionOf: DefinitionOf) => (band: LaidOutBand, theme: Theme, tones: ToneEnv, roles: Roles, stage?: number, dimFill?: boolean): string => {
  const def = definitionOf(band);
  if (!def) {
    throw new Error(`svg-diagram: no definition for the "${band.type}" band. emitSvg / emitHtml need the laid-out figure as the renderer returns it (its bands carry their definitions; a JSON or structuredClone copy loses them), or the definitions passed explicitly (the \`definitions\` option of emitHtml, the \`definitionOf\` argument of emitSvg)`);
  }
  const svg = def.emit(band as never, {theme, tones, roles, stage, dimFill, color: key => colorOf(key, theme)});
  return spotlighter.renderBand(band, svg, def);
};

/**
 * `definitionOf`: the definition of each placed band. The default finds them among the definitions the figure's own bands carry, which is
 * every band a selective entry drew; a full entry passes the table of the built-in definitions (placed-definitions.ts).
 * `parts`: mark each part's elements with `data-part` (ADR 0054), for the PowerPoint export; nothing else changes.
 */
export function emitSvg(laidOutDiagram: LaidOutDiagram, opts: {reveal?: number; noRecolor?: boolean; nodeIds?: boolean; parts?: boolean; definitions?: readonly BandDef[]} = {}, definitionOf: DefinitionOf = definitionsOf(laidOutDiagram.bands, opts.definitions)): string {
  const named = opts.nodeIds ? withNodeIds(laidOutDiagram) : laidOutDiagram;
  const services = {
    connectorDefs: connectorSvgDefs, defsNeeded: (band: LaidOutBand): SvgBandDefs => definitionOf(band)?.svgDefs?.(band as never) ?? {},
    renderBand: renderBandWith(definitionOf), renderConnect, diagramTitle, diagramDesc, spotlightDim,
  };
  return emitSvgWith(services, opts.parts ? withParts(named) : named, opts);
}
