// Spec parts of round R4 (see lib/spec.ts): quality, risk and problem-solving figures. Each keeps its schema, example, checks and builder
// together. A part whose builder writes words of its own in Japanese gets `en` (merged into the part for `lang: 'en'`); `lang` in a part
// is only ever set that way, never by the caller (the schema does not list it), and is taken off before the builder sees the options.
import { affinity, bowtie, causalLoop, faultTree, fmea, isIsNot, matrix, pdpc, relationDiagram, table } from '../dsl-pure.js';
import { defineAffinityPart } from './affinity.js';
import { defineFaultTreePart } from './fault-tree.js';
import { defineBowtiePart } from './bowtie.js';
import { defineFmeaPart } from './fmea.js';
import { defineIsIsNotPart } from './is-is-not.js';
import { defineMatrixPart } from './matrix.js';
import { definePdpcPart } from './pdpc.js';
import { defineRelationDiagramPart } from './relation-diagram.js';
import { defineCausalLoopPart } from './causal-loop.js';
export { MAX_FTA_EVENTS, MAX_FTA_DEPTH, MAX_RELATION_NODES, MAX_RELATION_LINKS, MAX_CAUSAL_NODES, MAX_CAUSAL_LINKS, MAX_CAUSAL_LOOPS, MAX_AFFINITY_CARDS } from './r4-common.js';
export const PARTS_R4 = [
    defineFaultTreePart(faultTree),
    defineBowtiePart(bowtie),
    defineFmeaPart(fmea),
    defineIsIsNotPart(isIsNot),
    defineMatrixPart(matrix, table),
    definePdpcPart(pdpc),
    defineRelationDiagramPart(relationDiagram),
    defineAffinityPart(affinity),
    defineCausalLoopPart(causalLoop),
];
