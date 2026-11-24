// Spec parts of round R4 (see lib/spec.ts): quality, risk and problem-solving figures. Each keeps its schema, example, checks and builder
// together. A part whose builder writes words of its own in Japanese gets `en` (merged into the part for `lang: 'en'`); `lang` in a part
// is only ever set that way, never by the caller (the schema does not list it), and is taken off before the builder sees the options.
import {affinity, bowtie, causalLoop, faultTree, fmea, isIsNot, matrix, pdpc, relationDiagram, table} from '../dsl-pure.ts';
import {defineAffinityPart} from './affinity.ts';
import type {PartDef} from '../spec-kit.ts';
import {defineFaultTreePart} from './fault-tree.ts';
import {defineBowtiePart} from './bowtie.ts';
import {defineFmeaPart} from './fmea.ts';
import {defineIsIsNotPart} from './is-is-not.ts';
import {defineMatrixPart} from './matrix.ts';
import {definePdpcPart} from './pdpc.ts';
import {defineRelationDiagramPart} from './relation-diagram.ts';
import {defineCausalLoopPart} from './causal-loop.ts';
export {MAX_FTA_EVENTS, MAX_FTA_DEPTH, MAX_RELATION_NODES, MAX_RELATION_LINKS, MAX_CAUSAL_NODES, MAX_CAUSAL_LINKS, MAX_CAUSAL_LOOPS, MAX_AFFINITY_CARDS} from './r4-common.ts';

export const PARTS_R4: readonly PartDef[] = [
  defineFaultTreePart<ReturnType<typeof faultTree>>(faultTree),
  defineBowtiePart<ReturnType<typeof bowtie>>(bowtie),
  defineFmeaPart<ReturnType<typeof fmea>>(fmea),
  defineIsIsNotPart<ReturnType<typeof isIsNot>>(isIsNot),
  defineMatrixPart<ReturnType<typeof matrix> | ReturnType<typeof table>>(matrix, table),
  definePdpcPart<ReturnType<typeof pdpc>>(pdpc),
  defineRelationDiagramPart<ReturnType<typeof relationDiagram>>(relationDiagram),
  defineAffinityPart<ReturnType<typeof affinity>>(affinity),
  defineCausalLoopPart<ReturnType<typeof causalLoop>>(causalLoop),
];
