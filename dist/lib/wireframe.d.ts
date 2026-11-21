import type { ToneEnv } from './tokens.ts';
import type { TextRequest, WidthOf, WrapMode } from './types/core.ts';
import type { Wf } from './types/wireframe-nodes.ts';
import type { WireframeBand, ScreensBand, LaidOutWireframe, LaidOutScreens } from './types/wireframe.ts';
export declare const wf: Wf;
export declare function collectTextRequests(band: WireframeBand | ScreensBand): TextRequest[];
export declare function layoutWireframe(band: WireframeBand, x: number, y: number, w: number, widthOf: WidthOf, tones: ToneEnv, wrap: WrapMode): LaidOutWireframe;
export declare function layoutScreens(band: ScreensBand, x: number, y: number, w: number, widthOf: WidthOf, tones: ToneEnv, wrap: WrapMode): LaidOutScreens;
