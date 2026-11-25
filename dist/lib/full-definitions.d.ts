import type { BandDef } from './band-def.ts';
import type { Band } from './types/index.ts';
type BandOf<T extends Band['type']> = Extract<Band, {
    type: T;
}>;
type DefinitionEntry<T extends Band['type']> = BandDef<BandOf<T>, object> | ((data: BandOf<T>) => BandDef<BandOf<T>, object>);
export declare const UNDEFINED_BANDS: {};
type FullDefinitions = {
    [T in Exclude<Band['type'], keyof typeof UNDEFINED_BANDS>]: DefinitionEntry<T>;
};
export declare const FULL_DEFINITIONS: FullDefinitions;
/** @internal Resolve a band against the full set of built-in definitions. */
export declare function definitionFor(data: Band): BandDef<never, object> | undefined;
/** The definition a band carries, or else the built-in one of its type: plain data from the all-in-one builders has none until it is rendered. */
export declare const definitionOfBand: (band: Band) => BandDef | undefined;
/** Every band, nested ones included, of plain data or of bands that carry their definitions. */
export declare const walkAnyBands: (bands: Band[], out?: Band[]) => Band[];
export {};
