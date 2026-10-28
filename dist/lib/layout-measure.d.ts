import type { DiagramData, FontFamily, MeasureRequest, Measured, Roles, WidthOf } from './types/core.ts';
import type { Band } from './types/index.ts';
export type Requests = Map<string, MeasureRequest>;
type BandOf<T extends Band['type']> = Extract<Band, {
    type: T;
}>;
/** What a measure handler registers through: single atoms, a band's own text runs, and (for a band that holds bands) its children. */
export interface MeasureCtx {
    readonly roles: Roles;
    /** Every atom of `text` at this size / weight / font. */
    atoms(text: string, size: number, weight: number, font?: FontFamily): void;
    /** A band's tag, stamp and text runs (what a caption / box / banner needs). */
    own(band: Band): void;
    /** A child band, by its own handler. */
    band(band: Band): void;
}
export type MeasureHandler<B> = (band: B, m: MeasureCtx) => void;
export type MeasureHandlerTable = {
    [T in Band['type']]: MeasureHandler<BandOf<T>>;
};
export declare const MEASURE_HANDLERS: {
    caption: MeasureHandler<Band>;
    box: MeasureHandler<Band>;
    banner: MeasureHandler<Band>;
    spacer: MeasureHandler<Band>;
    raw: MeasureHandler<Band>;
    status: MeasureHandler<import("./types/containers.ts").StatusBand>;
    group: (band: import("./types/containers.ts").GroupBand, m: MeasureCtx) => void;
    grouprow: MeasureHandler<Band>;
    row: MeasureHandler<Band>;
    grid: (band: import("./types/containers.ts").GridBand, m: MeasureCtx) => void;
    swimlane: (band: import("./types/sequence-table-swimlane.ts").SwimlaneBand, m: MeasureCtx) => void;
    legend: (band: import("./types/containers.ts").LegendBand, m: MeasureCtx) => void;
    connect: (band: import("./types/containers.ts").ConnectBand, m: MeasureCtx) => void;
    pyramid: (band: import("./types/figures.ts").PyramidBand, m: MeasureCtx) => void;
    curve: (band: import("./types/figures.ts").CurveBand, m: MeasureCtx) => void;
    image: (band: import("./types/image.ts").ImageBand, m: MeasureCtx) => void;
    sequence: MeasureHandler<import("./types/sequence-table-swimlane.ts").SequenceBand | import("./types/sequence-table-swimlane.ts").TableBand>;
    table: MeasureHandler<import("./types/sequence-table-swimlane.ts").SequenceBand | import("./types/sequence-table-swimlane.ts").TableBand>;
    wireframe: MeasureHandler<import("./types/wireframe.ts").WireframeBand>;
    screens: MeasureHandler<import("./types/wireframe.ts").ScreensBand>;
    plane: MeasureHandler<import("./types/figures.ts").PlaneBand>;
    quadrant: MeasureHandler<import("./quadrant.ts").QuadrantBand>;
    chevron: MeasureHandler<import("./flow-shapes.ts").FlowShapeBand>;
    wordart: MeasureHandler<import("./wordart-types.ts").WordArtBand>;
    funnel: MeasureHandler<import("./flow-shapes.ts").FlowShapeBand>;
    cycle: MeasureHandler<import("./flow-shapes.ts").FlowShapeBand>;
    venn: MeasureHandler<import("./flow-shapes.ts").FlowShapeBand>;
    concentric: MeasureHandler<import("./flow-shapes.ts").FlowShapeBand>;
    emblem: MeasureHandler<import("./flow-shapes.ts").FlowShapeBand>;
    bars: MeasureHandler<import("./types/bars.ts").BarsBand>;
    chart: MeasureHandler<import("./charts.ts").ChartBand>;
    people: MeasureHandler<import("./types/people-dots.ts").PeopleBand>;
    dots: MeasureHandler<import("./types/people-dots.ts").DotsBand>;
    math: () => undefined;
    timeline: MeasureHandler<import("./types/timeline.ts").NumericTimelineBand | import("./types/timeline.ts").TimelineBand>;
    bpmn: MeasureHandler<import("./types/diagrams.ts").BpmnBand>;
    fta: MeasureHandler<import("./types/diagrams.ts").FtaBand>;
    bowtie: MeasureHandler<import("./types/diagrams.ts").BowtieBand>;
    classes: MeasureHandler<import("./types/diagrams.ts").ClassesBand>;
    gantt: MeasureHandler<import("./types/timeline.ts").GanttBand>;
    cause: MeasureHandler<import("./types/diagrams.ts").CauseBand>;
    cloud: MeasureHandler<import("./types/diagrams.ts").CloudBand>;
    states: MeasureHandler<import("./types/diagrams.ts").StatesBand>;
    tree: MeasureHandler<import("./types/diagrams.ts").TreeBand>;
};
/** Pass 1: every atom this diagram needs measured, at the font sizes of `roles`. Pure: no measuring happens here. */
export declare function collectMeasures(data: DiagramData, roles: Roles): Requests;
/**
 * The width lookup over what measureAll(collectMeasures(...)) returned. An atom that was never registered measures 0 wide,
 * silently (a line then overflows its box); with `strict` that is an error. The caller reads SVG_DIAGRAM_STRICT_WIDTH
 * (layout itself touches no environment).
 */
export declare function widthOfMeasured(measured: Map<string, Measured>, strict: boolean): WidthOf;
export {};
