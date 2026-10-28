import type { GroupBand, LegendBand, ConnectBand, GroupRowBand, RowBand, GridBand, RawBand, SpacerBand, StatusBand } from './types/containers.ts';
import type { PyramidBand, CurveBand } from './types/figures.ts';
import type { ImageBand } from './types/image.ts';
import type { Band } from './types/index.ts';
import type { SwimlaneBand } from './types/sequence-table-swimlane.ts';
import type { BoxBand, CaptionBand, BannerBand } from './types/text-bands.ts';
import type { BandLayoutHandler, LayoutCtx } from './layout-ctx.ts';
type BandOf<T extends Band['type']> = Extract<Band, {
    type: T;
}>;
declare function layoutSpacer(band: SpacerBand, ctx: LayoutCtx): void;
declare function layoutStatusBand(band: StatusBand, ctx: LayoutCtx, padX: number, cw: number): void;
declare function layoutSeqTable(band: Band & {
    type: 'sequence' | 'table';
}, ctx: LayoutCtx, padX: number, cw: number): void;
declare function layoutWireframeBand(band: Band & {
    type: 'wireframe' | 'screens';
}, ctx: LayoutCtx, padX: number, cw: number): void;
declare function layoutRaw(band: RawBand, ctx: LayoutCtx, padX: number, cw: number): void;
declare function layoutFlowShapeBand(band: Band & {
    type: 'chevron' | 'funnel' | 'cycle' | 'venn' | 'concentric' | 'emblem';
}, ctx: LayoutCtx, padX: number, cw: number): void;
declare function layoutWordArtBand(band: Band & {
    type: 'wordart';
}, ctx: LayoutCtx, padX: number, cw: number): void;
/** caption / box / banner (and, as before, anything a handler does not claim). */
declare function layoutBoxLikeBand(band: CaptionBand | BoxBand | BannerBand, ctx: LayoutCtx, padX: number, cw: number): void;
/** Least room (px) a row's stretch must leave a group's content before the content is moved: under it, the content stays at the top. */
export declare const GROUP_FILL_MIN = 16;
/**
 * How `slack` px are shared inside a group of `n` children: each of the n-1 gaps grows by up to 16px (in 4px steps), and what is
 * still left is split above and below, the top part on the grid.
 */
export declare function groupFillPlan(n: number, slack: number): {
    top: number;
    gap: number;
};
declare function layoutGroup(band: GroupBand, ctx: LayoutCtx, padX: number, cw: number): void;
declare function layoutImageBand(band: ImageBand, ctx: LayoutCtx, padX: number, cw: number): void;
declare function layoutSwimlane(band: SwimlaneBand, ctx: LayoutCtx, padX: number, cw: number): void;
declare function layoutLegend(band: LegendBand, ctx: LayoutCtx, padX: number, cw: number): void;
declare function layoutConnect(band: ConnectBand, ctx: LayoutCtx, _padX: number, _cw: number): void;
declare function layoutGroupRow(band: GroupRowBand, ctx: LayoutCtx, padX: number, cw: number): void;
declare function layoutRow(band: RowBand, ctx: LayoutCtx, padX: number, cw: number): void;
declare function layoutPyramid(band: PyramidBand, ctx: LayoutCtx, padX: number, cw: number): void;
declare function layoutCurve(band: CurveBand, ctx: LayoutCtx, padX: number, cw: number): void;
declare function layoutGridBand(band: GridBand, ctx: LayoutCtx, padX: number, cw: number): void;
/**
 * The handler of every band type. Typed per key, so each handler is checked against its own band type; the `satisfies` below
 * and UnhandledBandTypes make a band type without one a compile error.
 */
export declare const LAYOUT_HANDLERS: {
    spacer: typeof layoutSpacer;
    status: typeof layoutStatusBand;
    group: typeof layoutGroup;
    sequence: typeof layoutSeqTable;
    table: typeof layoutSeqTable;
    image: typeof layoutImageBand;
    timeline: BandLayoutHandler<BandOf<"timeline">>;
    bpmn: BandLayoutHandler<import("./types/diagrams.ts").BpmnBand>;
    fta: BandLayoutHandler<import("./types/diagrams.ts").FtaBand>;
    bowtie: BandLayoutHandler<import("./types/diagrams.ts").BowtieBand>;
    classes: BandLayoutHandler<import("./types/diagrams.ts").ClassesBand>;
    gantt: BandLayoutHandler<import("./types/timeline.ts").GanttBand>;
    cause: BandLayoutHandler<(import("./types/diagrams.ts").CauseBand & {
        type: 'cause' | 'cloud';
    }) | (import("./types/diagrams.ts").CloudBand & {
        type: 'cause' | 'cloud';
    })>;
    cloud: BandLayoutHandler<(import("./types/diagrams.ts").CauseBand & {
        type: 'cause' | 'cloud';
    }) | (import("./types/diagrams.ts").CloudBand & {
        type: 'cause' | 'cloud';
    })>;
    states: BandLayoutHandler<import("./types/diagrams.ts").StatesBand>;
    tree: BandLayoutHandler<import("./types/diagrams.ts").TreeBand>;
    bars: BandLayoutHandler<import("./types/bars.ts").BarsBand>;
    chart: BandLayoutHandler<import("./charts.ts").ChartBand>;
    people: BandLayoutHandler<(import("./types/people-dots.ts").DotsBand & {
        type: 'people' | 'dots';
    }) | (import("./types/people-dots.ts").PeopleBand & {
        type: 'people' | 'dots';
    })>;
    dots: BandLayoutHandler<(import("./types/people-dots.ts").DotsBand & {
        type: 'people' | 'dots';
    }) | (import("./types/people-dots.ts").PeopleBand & {
        type: 'people' | 'dots';
    })>;
    math: BandLayoutHandler<import("./types/math.ts").MathBand>;
    wireframe: typeof layoutWireframeBand;
    screens: typeof layoutWireframeBand;
    swimlane: typeof layoutSwimlane;
    legend: typeof layoutLegend;
    connect: typeof layoutConnect;
    raw: typeof layoutRaw;
    grouprow: typeof layoutGroupRow;
    row: typeof layoutRow;
    grid: typeof layoutGridBand;
    pyramid: typeof layoutPyramid;
    plane: BandLayoutHandler<import("./types/figures.ts").PlaneBand>;
    quadrant: BandLayoutHandler<import("./quadrant.ts").QuadrantBand>;
    chevron: typeof layoutFlowShapeBand;
    wordart: typeof layoutWordArtBand;
    funnel: typeof layoutFlowShapeBand;
    cycle: typeof layoutFlowShapeBand;
    venn: typeof layoutFlowShapeBand;
    concentric: typeof layoutFlowShapeBand;
    emblem: typeof layoutFlowShapeBand;
    curve: typeof layoutCurve;
    caption: typeof layoutBoxLikeBand;
    box: typeof layoutBoxLikeBand;
    banner: typeof layoutBoxLikeBand;
};
/** Band types with no handler in LAYOUT_HANDLERS: must be `never`, so adding a band type without one fails to compile. */
export type UnhandledBandTypes = Exclude<Band['type'], keyof typeof LAYOUT_HANDLERS>;
export declare const ALL_BANDS_HANDLED: UnhandledBandTypes extends never ? true : never;
/** What stack() runs for a band: its handler, or (a type nobody claims, as always) the caption / box / banner one. */
export declare function layoutHandlerFor(type: Band['type']): BandLayoutHandler<never>;
export {};
