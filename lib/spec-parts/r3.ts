// Spec parts of round R3 (see lib/spec.ts): each keeps its schema, example, checks and builder together.
// Systems and plans: a BPMN process, a class diagram, a PERT network, a time axis, a tree and a dependency network.
import {bpmn, classDiagram, dependencyNetwork, pert, timeline, tree} from '../dsl-pure.ts';
import type {PartDef} from '../spec-kit.ts';
import {defineBpmnPart} from './bpmn.ts';
import {defineClassDiagramPart} from './class-diagram.ts';
import {definePertPart} from './pert.ts';
import {defineTimelinePart} from './timeline.ts';
import {defineTreePart} from './tree.ts';
import {defineDependencyNetworkPart} from './dependency-network.ts';

export {MAX_BPMN_NODES, MAX_BPMN_FLOWS, MAX_CLASSES, MAX_CLASS_RELATIONS, MAX_PERT_TASKS, MAX_DEPENDENCY_NODES, MAX_DEPENDENCY_EDGES, remainingEn} from './r3-common.ts';

export const PARTS_R3: readonly PartDef[] = [
  defineBpmnPart<ReturnType<typeof bpmn>>(bpmn),
  defineClassDiagramPart<ReturnType<typeof classDiagram>>(classDiagram),
  definePertPart<ReturnType<typeof pert>>(pert),
  defineTimelinePart<ReturnType<typeof timeline>>(timeline),
  defineTreePart<ReturnType<typeof tree>>(tree),
  defineDependencyNetworkPart<ReturnType<typeof dependencyNetwork>>(dependencyNetwork),
];
