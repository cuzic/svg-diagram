import type { BandDef, WithBandDef } from '../band-def.ts';
import { relationDiagram as buildRelation } from '../dsl/cause.ts';
import type { PdpcLink, PdpcNode, RelationNode, RelationOpts } from '../dsl/cause.ts';
import type { CauseBand, CauseLink, CauseNode, CauseOpts, LaidOutCause } from '../types/diagrams.ts';
export { transitionUnits } from '../dsl/cause.ts';
export declare const causeDefinition: BandDef<CauseBand, LaidOutCause>;
export declare function causeTree<const N extends readonly CauseNode[], const Id extends string = never>(nodes: N, links: readonly CauseLink[], opts?: CauseOpts & {
    id?: Id;
}): WithBandDef<CauseBand & import("../strict.ts").Declares<Id | Extract<N[number]["id"], string>> & import("../strict.ts").HandleOf<Id> & import("../strict.ts").AnchorsOf<Extract<N[number]["id"], string>>, LaidOutCause>;
export declare function pdpc<const N extends readonly PdpcNode[], const Id extends string = never>(nodes: N, links: readonly PdpcLink[], opts?: CauseOpts & {
    id?: Id;
}): WithBandDef<CauseBand & import("../strict.ts").Declares<Id | Extract<N[number]["id"], string>> & import("../strict.ts").HandleOf<Id> & import("../strict.ts").AnchorsOf<Extract<N[number]["id"], string>>, LaidOutCause>;
export declare function relationDiagram<const N extends readonly RelationNode[], const Id extends string = never>(nodes: N, links: Parameters<typeof buildRelation>[1], opts?: RelationOpts & {
    id?: Id;
}): WithBandDef<CauseBand & import("../strict.ts").Declares<Id | Extract<N[number]["id"], string>> & import("../strict.ts").HandleOf<Id> & import("../strict.ts").AnchorsOf<Extract<N[number]["id"], string>>, LaidOutCause>;
