import type { WireframeDecorations, WireframeWidgetRenderer } from './wireframe-layout-core.ts';
export type { WireframeDecorations, WireframeWidgetRenderer };
export { spacerRenderer, colRenderer, rowRenderer, cardRenderer, textRenderer, btnRenderer, chipRenderer, inputRenderer, selectRenderer, tabsRenderer, appbarRenderer, seekRenderer, kvRenderer, statRenderer, listRenderer, tableRenderer, alertRenderer, imageRenderer, videoRenderer, heatRenderer, pointcloudRenderer, chartRenderer, mapRenderer, dialogRenderer, toastRenderer, } from './wireframe-layout-core.ts';
export { toggleRenderer, checkboxRenderer, sliderRenderer, batteryRenderer, signalRenderer, radioRenderer, robotRenderer, insightRenderer, regionRenderer, breadcrumbRenderer, fusionRenderer, compareRenderer, widgetStates, robotMarkers, } from './wireframe-parts.ts';
/** Create a wireframe builder with only the supplied drawing and measurement callbacks. */
export declare function createWireframe(renderers: readonly WireframeWidgetRenderer[], decorations?: WireframeDecorations): <const Id extends string = never>(root: import("./dsl-pure.ts").WfRoot, opts?: import("./dsl-pure.ts").WireframeOpts & {
    id?: Id;
}) => import("./band-def.ts").WithBandDef<ReturnType<typeof import("./dsl/wireframe.ts").wireframe<Id>>, import("./dsl-pure.ts").LaidOutWireframe>;
/** Create a screen grid builder with only the supplied widgets and decorations. */
export declare function createScreenGrid(renderers: readonly WireframeWidgetRenderer[], decorations?: WireframeDecorations): <const Id extends string = never>(items: import("./strict.ts").ScreensItemInput<Id>[], opts?: import("./dsl-pure.ts").ScreensOpts) => import("./band-def.ts").WithBandDef<ReturnType<typeof import("./dsl/wireframe.ts").screens<Id>>, import("./dsl-pure.ts").LaidOutScreens>;
/** Create a state matrix builder with only the supplied widgets and decorations. */
export declare function createStateMatrix(renderers: readonly WireframeWidgetRenderer[], decorations?: WireframeDecorations): <const C extends string[], const R extends readonly (import("./strict.ts").StateRowLoose | import("./dsl-pure.ts").PartRow<never, string>)[]>(cols: C, rows: readonly [...R] & import("./strict.ts").ValidateStateRows<C, R>, opts?: Omit<import("./dsl-pure.ts").StateMatrixOpts, 'required'> & {
    required?: C[number][];
}) => import("./band-def.ts").WithBandDef<import("./dsl-pure.ts").ScreensBand, import("./dsl-pure.ts").LaidOutScreens>;
/** Create screen and state matrix builders that share the supplied widget registry. */
export declare function createScreens(renderers: readonly WireframeWidgetRenderer[], decorations?: WireframeDecorations): {
    screens: <const Id extends string = never>(items: import("./strict.ts").ScreensItemInput<Id>[], opts?: import("./dsl-pure.ts").ScreensOpts) => import("./band-def.ts").WithBandDef<ReturnType<typeof import("./dsl/wireframe.ts").screens<Id>>, import("./dsl-pure.ts").LaidOutScreens>;
    stateMatrix: <const C extends string[], const R extends readonly (import("./strict.ts").StateRowLoose | import("./dsl-pure.ts").PartRow<never, string>)[]>(cols: C, rows: readonly [...R] & import("./strict.ts").ValidateStateRows<C, R>, opts?: Omit<import("./dsl-pure.ts").StateMatrixOpts, 'required'> & {
        required?: C[number][];
    }) => import("./band-def.ts").WithBandDef<import("./dsl-pure.ts").ScreensBand, import("./dsl-pure.ts").LaidOutScreens>;
};
