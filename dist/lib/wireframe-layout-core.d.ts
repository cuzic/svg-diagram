import type { ToneEnv } from './tokens.ts';
import type { BadgeBox } from './badge.ts';
import type { TextRequest, WidthOf, WrapMode } from './types/core.ts';
import type { WfHelpers, WfPartsApi, WfNode, WfNodeOf, WfCtx, WfType, WfDrawFn, WfNatFn, WfDrawTable, WfNatTable, WfAutoWTable, WfTone, WfDialog, WfToast, WfOverlay, BadgeOpts, DrawShapeOpts, DrawTextOpts, WfAutoWFn } from './types/wireframe-nodes.ts';
import type { WireframeBand, ScreensBand, LaidOutWireframe, LaidOutScreens } from './types/wireframe.ts';
declare const S = 14, T = 15;
declare const lh: (s: number) => number;
export declare function collectScreenGridTextRequestsWith(band: ScreensBand, runtime: WireframeRuntime): TextRequest[];
export declare function collectStateMatrixTextRequestsWith(band: ScreensBand, runtime: WireframeRuntime): TextRequest[];
export declare function collectTextRequestsWith(band: WireframeBand | ScreensBand, runtime: WireframeRuntime): TextRequest[];
type OverlayRenderer<T extends WfOverlay> = (overlay: T, ctx: WfCtx, x: number, y: number, w: number, h: number) => void;
export interface WireframeDecorations {
    dialog?: OverlayRenderer<WfDialog>;
    toast?: OverlayRenderer<WfToast>;
    states?: Pick<WfPartsApi, 'drawState' | 'stateMinH'> & {
        labels(): readonly string[];
    };
    robotMarkers?: Pick<WfPartsApi, 'glyph' | 'fovSector' | 'headingArrow'>;
}
export interface WireframeRuntime extends WireframeDecorations {
    draw: WfDrawTable;
    nat?: WfNatTable;
    autoWidth?: WfAutoWTable;
    always?: readonly string[];
    strings?(node: WfNode): readonly string[];
}
declare const tw: (ctx: WfCtx, s: string | number, size: number, weight: number) => number;
declare const wrapT: (ctx: WfCtx, s: string | number, size: number, weight: number, maxW: number) => string[];
declare const rect: (ctx: WfCtx, x: number, y: number, w: number, h: number, o?: DrawShapeOpts) => void;
declare const circle: (ctx: WfCtx, cx: number, cy: number, r: number, o?: DrawShapeOpts) => void;
declare const text: (ctx: WfCtx, s: string | number, x: number, base: number, o?: DrawTextOpts) => void;
declare const badge: (ctx: WfCtx, cx: number, cy: number, label: string | number, o?: BadgeOpts) => BadgeBox;
declare const pts: (ps: [number, number][]) => string;
declare const path: (ctx: WfCtx, d: string, o?: DrawShapeOpts) => void;
declare const line: (ctx: WfCtx, x1: number, y1: number, x2: number, y2: number, o?: DrawShapeOpts) => void;
declare const mid: (cy: number, size?: number) => number;
declare const chipW: (ctx: WfCtx, label: string) => number;
declare function drawChip(ctx: WfCtx, label: string, x: number, y: number, tone?: WfTone): number;
export interface WidgetRenderer<K extends WfType> {
    type: K;
    draw: WfDrawFn<WfNodeOf<K>>;
    height?: WfNatFn<WfNodeOf<K>>;
    strings?(node: WfNodeOf<K>): readonly string[];
    width?: WfAutoWFn<WfNodeOf<K>>;
}
export type WireframeWidgetRenderer = {
    [K in WfType]: WidgetRenderer<K>;
}[WfType];
export declare const spacerRenderer: WidgetRenderer<'spacer'>;
export declare const colRenderer: WidgetRenderer<'col'>;
export declare const rowRenderer: WidgetRenderer<'row'>;
export declare const cardRenderer: WidgetRenderer<'card'>;
export declare const textRenderer: WidgetRenderer<'text'>;
export declare const btnRenderer: WidgetRenderer<'btn'>;
export declare const chipRenderer: WidgetRenderer<'chip'>;
export declare const inputRenderer: WidgetRenderer<'input'>;
export declare const selectRenderer: WidgetRenderer<'select'>;
export declare const tabsRenderer: WidgetRenderer<'tabs'>;
export declare const appbarRenderer: WidgetRenderer<'appbar'>;
export declare const seekRenderer: WidgetRenderer<'seek'>;
export declare const kvRenderer: WidgetRenderer<'kv'>;
export declare const statRenderer: WidgetRenderer<'stat'>;
export declare const listRenderer: WidgetRenderer<'list'>;
export declare const tableRenderer: WidgetRenderer<'table'>;
export declare const alertRenderer: WidgetRenderer<'alert'>;
export declare const imageRenderer: WidgetRenderer<'image'>;
export declare const videoRenderer: WidgetRenderer<'video'>;
export declare const heatRenderer: WidgetRenderer<'heat'>;
export declare const pointcloudRenderer: WidgetRenderer<'pointcloud'>;
export declare const chartRenderer: WidgetRenderer<'chart'>;
export declare const mapRenderer: WidgetRenderer<'map'>;
declare function hideUnder(ctx: WfCtx, X: number, Y: number, W: number, H: number): void;
export declare const toastRenderer: OverlayRenderer<WfToast>;
export declare const dialogRenderer: OverlayRenderer<WfDialog>;
export declare function layoutWireframeWith(runtime: WireframeRuntime, band: WireframeBand, x: number, y: number, w: number, widthOf: WidthOf, tones: ToneEnv, wrap: WrapMode): LaidOutWireframe;
export declare function layoutStateMatrixWith(runtime: WireframeRuntime, band: ScreensBand, x: number, y: number, w: number, widthOf: WidthOf, tones: ToneEnv, wrap: WrapMode): LaidOutScreens;
export declare function layoutScreenGridWith(runtime: WireframeRuntime, band: ScreensBand, x: number, y: number, w: number, widthOf: WidthOf, tones: ToneEnv, wrap: WrapMode): LaidOutScreens;
export declare function layoutScreensWith(runtime: WireframeRuntime, band: ScreensBand, x: number, y: number, w: number, widthOf: WidthOf, tones: ToneEnv, wrap: WrapMode): LaidOutScreens;
/** Build a private renderer table from explicit widget definitions. */
export declare function makeWireframeRuntime(renderers: readonly WireframeWidgetRenderer[], decorations?: WireframeDecorations): WireframeRuntime;
/** Native widgets and frame layout, without monitoring widgets or state decoration. */
export declare const basicWireframeRuntime: WireframeRuntime;
export declare function wireframeHelpers(): Pick<WfHelpers, 'DRAW' | 'NAT' | 'AUTO_W'>;
export { S, T, lh, rect, circle, badge, text, path, line, pts, mid, tw, wrapT, drawChip, chipW, hideUnder };
