import type { BandDef, WithBandDef } from '../band-def.ts';
import { classDiagram as build } from '../dsl/classes.ts';
import type { ClassesBand, ClassesOpts, LaidOutClasses, ClassItem, ClassRelation } from '../types/diagrams.ts';
export declare function classDiagram<const C extends readonly ClassItem[], const Id extends string = never>(classes: C, relations: readonly ClassRelation[], opts?: ClassesOpts & {
    id?: Id;
}): WithBandDef<ReturnType<typeof build<C, Id>>, LaidOutClasses>;
/** @internal Definition used by the full renderer. */
export declare const classesDefinition: BandDef<ClassesBand, LaidOutClasses>;
