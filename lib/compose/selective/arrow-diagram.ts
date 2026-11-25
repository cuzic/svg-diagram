import {band} from '../../band-def.ts';
import {captionDefinition} from '../../bands/caption.ts';
import {statesDefinition} from '../../bands/states.ts';
import {arrowDiagram as build} from '../../dsl/diagrams.ts';
import type {ArrowDiagramOpts} from '../../dsl/diagrams.ts';
import type {ArrowActivity} from '../../qc.ts';

export type {ArrowDiagramOpts, ArrowActivity};

export function arrowDiagram(activities: readonly ArrowActivity[], opts?: ArrowDiagramOpts) {
  return build(activities, opts).map(data => data.type === 'states'
    ? band(statesDefinition, data)
    : band(captionDefinition, data));
}
