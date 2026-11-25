import { node as buildNode } from '../dsl/node.ts';
import type { NodeOpts } from '../dsl/node.ts';
import { stat as buildStat } from '../dsl/stat.ts';
import type { RichText, StatOpts } from '../types/text-bands.ts';
import type { BandDef, DiagramFindings, WithBandDef } from '../band-def.ts';
import { box as buildBox } from '../dsl/box.ts';
import type { BoxInput } from '../strict.ts';
import type { BoxBand, LaidOutBox } from '../types/text-bands.ts';
/** Shared by every band that is drawn as a box, so a check runs once per diagram. */
export declare const boxDiagramFindings: readonly DiagramFindings[];
export declare const boxDefinition: BandDef<BoxBand, LaidOutBox>;
export declare function box<const Id extends string = never>(opts: BoxInput<Id>): WithBandDef<ReturnType<typeof buildBox<Id>>, LaidOutBox>;
export declare function node<const Id extends string = never>(opts: NodeOpts & {
    id?: Id;
}): WithBandDef<ReturnType<typeof buildNode<Id>>, LaidOutBox>;
export declare function stat<const Id extends string = never>(value: string | number, label: RichText, opts?: StatOpts & {
    id?: Id;
}): WithBandDef<ReturnType<typeof buildStat<Id>>, LaidOutBox>;
export type { NodeOpts } from '../dsl/node.ts';
export type { StatOpts } from '../types/text-bands.ts';
export { icon } from '../icon-registry.ts';
export { em } from '../rich.ts';
