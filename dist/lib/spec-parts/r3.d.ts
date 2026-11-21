import type { PartDef } from '../spec-kit.ts';
/** Nodes and arrows of the graph figures below. Their layouts search orders of the whole graph: these keep the worst allowed input near 2 s on a worker. */
export declare const MAX_BPMN_NODES = 30;
export declare const MAX_BPMN_FLOWS = 40;
export declare const MAX_CLASSES = 15;
export declare const MAX_CLASS_RELATIONS = 24;
export declare const MAX_PERT_TASKS = 20;
export declare const MAX_DEPENDENCY_NODES = 20;
export declare const MAX_DEPENDENCY_EDGES = 32;
/** The English of the span the figure writes from now to the deadline ("1 year 3 months left"), counted the way lib/timeline.ts counts. */
export declare function remainingEn(from: string, to: string): string;
export declare const PARTS_R3: readonly PartDef[];
