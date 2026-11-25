import type { BandDef, WithBandDef } from './band-def.ts';
import { screens as build } from './dsl/wireframe.ts';
import type { ScreensItemInput, StateRowLoose, ValidateStateRows } from './strict.ts';
import type { LaidOutScreens, PartRow, ScreensBand, ScreensOpts, StateMatrixOpts } from './types/wireframe.ts';
import type { BandLayoutHandler } from './layout-ctx.ts';
import type { TextRequest } from './types/core.ts';
export declare function screensDefinition(collect: (data: ScreensBand) => TextRequest[], place: BandLayoutHandler<ScreensBand>, findings?: DefinitionFindings): Definition;
type Definition = BandDef<ScreensBand, LaidOutScreens>;
type DefinitionFindings = NonNullable<Definition['verify']>['findings'];
export declare function screensBuilder(definition: Definition): <const Id extends string = never>(items: ScreensItemInput<Id>[], opts?: ScreensOpts) => WithBandDef<ReturnType<typeof build<Id>>, LaidOutScreens>;
export declare function stateMatrixBuilder(definition: Definition): <const C extends string[], const R extends readonly (StateRowLoose | PartRow<never, string>)[]>(cols: C, rows: readonly [...R] & ValidateStateRows<C, R>, opts?: Omit<StateMatrixOpts, 'required'> & {
    required?: C[number][];
}) => WithBandDef<ScreensBand, LaidOutScreens>;
export {};
