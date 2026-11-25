// Spec parts of round R3 (see lib/spec.ts): each keeps its schema, example, checks and builder together.
// Systems and plans: a BPMN process, a class diagram, a PERT network, a time axis, a tree and a dependency network.
import { bpmn, classDiagram, dependencyNetwork, pert, timeline, tree } from '../dsl-pure.js';
import { defineBpmnPart } from './bpmn.js';
import { defineClassDiagramPart } from './class-diagram.js';
import { definePertPart } from './pert.js';
import { defineTimelinePart } from './timeline.js';
import { defineTreePart } from './tree.js';
import { defineDependencyNetworkPart } from './dependency-network.js';
export { MAX_BPMN_NODES, MAX_BPMN_FLOWS, MAX_CLASSES, MAX_CLASS_RELATIONS, MAX_PERT_TASKS, MAX_DEPENDENCY_NODES, MAX_DEPENDENCY_EDGES, remainingEn } from './r3-common.js';
export const PARTS_R3 = [
    defineBpmnPart(bpmn),
    defineClassDiagramPart(classDiagram),
    definePertPart(pert),
    defineTimelinePart(timeline),
    defineTreePart(tree),
    defineDependencyNetworkPart(dependencyNetwork),
];
