import {band} from '../band-def.ts';
import type {BandDef, WithBandDef} from '../band-def.ts';
import {causeTree as buildTree, pdpc as buildPdpc, relationDiagram as buildRelation} from '../dsl/cause.ts';
import type {PdpcLink, PdpcNode, RelationNode, RelationOpts} from '../dsl/cause.ts';
import {renderCause} from '../emit-figures.ts';
import {snapGrid} from '../layout-util.ts';
import {scopeOf} from '../scope-name.ts';
import {causeTexts, layoutCauseBand} from '../toc.ts';
import type {CauseBand, CauseLink, CauseNode, CauseOpts, LaidOutCause} from '../types/diagrams.ts';
import {causeFindings} from '../verify-cause.ts';
import {anchorRects} from '../verify-rects.ts';

export {transitionUnits} from '../dsl/cause.ts';

const definition = {
  type: 'cause',
  ids: data => data.nodes.filter(node => !data.unanchored?.includes(node.id)).map(node => node.id),
  measure(data, {atoms, roles}) {
    for (const [text, size, weight, font] of causeTexts(data, roles)) atoms(text, size, weight, font);
  },
  layout(data, {x, y, w, widthOf, roles, wrap}) {
    const scope = scopeOf(data);
    const placed = layoutCauseBand(data, x, snapGrid(y), w, widthOf, roles, {wrap, keepWords: false});
    const laid = scope ? {...placed, scope} : placed;
    const anchors = laid.anchors.filter(anchor => !data.unanchored?.includes(anchor.id));
    return {laid, h: laid.h, anchors};
  },
  emit: (laid, {theme, tones}) => renderCause(laid, theme, tones),
  verify: {
    rects: laid => anchorRects(laid),
    check(laid) {
      const {problems, warnings} = causeFindings(laid);
      return [
        ...problems.map(message => ({rule: 'cause', severity: 'problem' as const, message})),
        ...warnings.map(message => ({rule: 'cause', severity: 'warn' as const, message})),
      ];
    },
  },
} satisfies BandDef<CauseBand, LaidOutCause>;

function define<D extends CauseBand>(data: D): WithBandDef<D, LaidOutCause> {
  return band<D, LaidOutCause>(definition, data);
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
