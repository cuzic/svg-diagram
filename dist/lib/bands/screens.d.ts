import { screensDefinition } from '../screens-definition.ts';
export { stateRow } from '../dsl/state-matrix.ts';
export { wf } from '../wireframe.ts';
export declare const screens: <const Id extends string = never>(items: import("../strict.ts").ScreensItemInput<Id>[], opts?: import("../dsl-pure.ts").ScreensOpts) => import("../band-def.ts").WithBandDef<ReturnType<typeof import("../dsl/wireframe.ts").screens<Id>>, import("../dsl-pure.ts").LaidOutScreens>;
export declare const stateMatrix: <const C extends string[], const R extends readonly (import("../strict.ts").StateRowLoose | import("../dsl-pure.ts").PartRow<never, string>)[]>(cols: C, rows: readonly [...R] & import("../strict.ts").ValidateStateRows<C, R>, opts?: Omit<import("../dsl-pure.ts").StateMatrixOpts, 'required'> & {
    required?: C[number][];
}) => import("../band-def.ts").WithBandDef<import("../dsl-pure.ts").ScreensBand, import("../dsl-pure.ts").LaidOutScreens>;
/** @internal Definitions used by the full renderer. */
export declare const screenGridDefinition: ReturnType<typeof screensDefinition>;
export declare const stateMatrixDefinition: ReturnType<typeof screensDefinition>;
