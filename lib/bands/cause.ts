import {edgeBendFindings} from '../verify-edge-bends.ts';
import {parallelEdgeFindings} from '../verify-cause-spacing.ts';
import {densityRestorationFindings} from '../verify-density.ts';
import {texts} from '../band-text-sizes.ts';
import {analysisFindings} from '../finding-rules.ts';
import {tocFindings} from '../toc-rules.ts';
import {band} from '../band-def.ts';
import type {BandDef, WithBandDef} from '../band-def.ts';
import {causeTree as buildTree, pdpc as buildPdpc, relationDiagram as buildRelation} from '../dsl/cause.ts';
import type {PdpcLink, PdpcNode, RelationNode, RelationOpts} from '../dsl/cause.ts';
import {renderCause} from '../emit-figures.ts';
import {placeCause} from '../layout-cause.ts';
import {causeTexts} from '../toc.ts';
import type {CauseBand, CauseLink, CauseNode, CauseOpts, LaidOutCause} from '../types/diagrams.ts';
import {causeFindings} from '../verify-cause.ts';
import {anchorRects} from '../verify-rects.ts';

export {transitionUnits} from '../dsl/cause.ts';

export const causeDefinition: BandDef<CauseBand, LaidOutCause> = {
  type: 'cause',
  textSizes: texts,
  ids: data => data.nodes.filter(node => !data.unanchored?.includes(node.id)).map(node => node.id),
  measure(data, {atoms, roles}) {
    for (const [text, size, weight, font] of causeTexts(data, roles)) atoms(text, size, weight, font);
  },
  internal: true,
  layout: placeCause,
  emit: (laid, {theme, tones}) => renderCause(laid, theme, tones),
  verify: {
    diagramFindings: [densityRestorationFindings, parallelEdgeFindings, edgeBendFindings],
    findings: data => analysisFindings(data, [...(data.rca?.findings ?? []), ...tocFindings(data)]),
    rects: laid => anchorRects(laid),
    check(laid) {
      const {problems, warnings} = causeFindings(laid);
      return [
        ...problems.map(message => ({rule: 'cause', severity: 'problem' as const, message})),
        ...warnings.map(message => ({rule: 'cause', severity: 'warn' as const, message})),
      ];
    },
  },
};

function define<D extends CauseBand>(data: D): WithBandDef<D, LaidOutCause> {
  return band<D, LaidOutCause>(causeDefinition, data);
}

export function causeTree<const N extends readonly CauseNode[], const Id extends string = never>(nodes: N, links: readonly CauseLink[], opts?: CauseOpts & {id?: Id}) {
  return define(buildTree<N, Id>(nodes, links, opts));
}

export function pdpc<const N extends readonly PdpcNode[], const Id extends string = never>(nodes: N, links: readonly PdpcLink[], opts?: CauseOpts & {id?: Id}) {
  return define(buildPdpc<N, Id>(nodes, links, opts));
}

export function relationDiagram<const N extends readonly RelationNode[], const Id extends string = never>(nodes: N, links: Parameters<typeof buildRelation>[1], opts?: RelationOpts & {id?: Id}) {
  return define(buildRelation<N, Id>(nodes, links, opts));
}
