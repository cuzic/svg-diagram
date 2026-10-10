import type { Wf, WireframeBand, ScreensBand, LaidOutWireframe, LaidOutScreens, TextRequest, WidthOf } from './types.ts';
export declare const wf: Wf;
export declare function collectTextRequests(band: WireframeBand | ScreensBand): TextRequest[];
export declare function layoutWireframe(band: WireframeBand, x: number, y: number, w: number, widthOf: WidthOf): LaidOutWireframe;
export declare function layoutScreens(band: ScreensBand, x: number, y: number, w: number, widthOf: WidthOf): LaidOutScreens;
