import type { BandDef } from './band-def.ts';
import type { LaidOutFlowShape } from './flow-shapes.ts';
import type { LaidOutQuadrant } from './quadrant.ts';
import type { LaidOutGrid, LaidOutRow } from './types/containers.ts';
import type { LaidOutBpmn, LaidOutCause, LaidOutTree } from './types/diagrams.ts';
import type { LaidOutBand, LaidOutDiagram } from './types/index.ts';
import type { LaidOutBox } from './types/text-bands.ts';
export declare const nameBoxNode: (band: LaidOutBox) => LaidOutBox;
export declare const nameBoxChildren: <B extends LaidOutRow | LaidOutGrid>(band: B) => B;
export declare const nameTreeNodes: (band: LaidOutTree) => LaidOutTree;
export declare const nameCauseNodes: (band: LaidOutCause) => LaidOutCause;
export declare const nameBpmnNodes: (band: LaidOutBpmn) => LaidOutBpmn;
export declare const nameFlowShapeNodes: (band: LaidOutFlowShape) => LaidOutFlowShape;
/** The marker and every line of the name carry it: a click on either finds the item. */
export declare const nameQuadrantNodes: (band: LaidOutQuadrant) => LaidOutQuadrant;
type DefinitionOf = (band: LaidOutBand) => BandDef | undefined;
/** The band with its nodes named by its definition; a band whose definition names none is returned as it is. */
export declare function withNodeIdsBand(band: LaidOutBand, definitionOf?: DefinitionOf): LaidOutBand;
/** The laid-out diagram with the names of its nodes on them. */
export declare const withNodeIds: (d: LaidOutDiagram, definitionOf?: DefinitionOf) => LaidOutDiagram;
export {};
