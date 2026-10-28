import type { ToneEnv } from './tokens.ts';
import type { Theme, Roles } from './types/core.ts';
import type { LaidOutBand } from './types/index.ts';
import type { LaidOutType } from './band-table.ts';
export interface EmitHandler<B> {
    render(band: B, day: Theme, tones: ToneEnv, roles: Roles, stage: number | undefined, dimFill: boolean): string;
    selfDimming?: true;
}
/** One emitter per band type, each checked against its own band type; a band type without one fails to compile. */
export declare const EMIT_HANDLERS: {
    caption: {
        render: (b: import("./types/text-bands.ts").LaidOutCaption & import("./types/core.ts").Dimmed, day: Theme, tones: ToneEnv) => string;
        selfDimming: true;
    };
    status: {
        render: (b: import("./types/containers.ts").LaidOutStatus & import("./types/core.ts").Dimmed) => string;
    };
    box: {
        render: (b: import("./types/text-bands.ts").LaidOutBox & import("./types/core.ts").Dimmed, day: Theme, tones: ToneEnv, roles: Roles) => string;
        selfDimming: true;
    };
    banner: {
        render: (b: import("./types/text-bands.ts").LaidOutBanner & import("./types/core.ts").Dimmed, day: Theme, tones: ToneEnv, roles: Roles) => string;
        selfDimming: true;
    };
    group: {
        render: (b: import("./types/containers.ts").LaidOutGroup & import("./types/core.ts").Dimmed, day: Theme, tones: ToneEnv, roles: Roles) => string;
        selfDimming: true;
    };
    legend: {
        render: (b: import("./types/containers.ts").LaidOutLegend & import("./types/core.ts").Dimmed, day: Theme, tones: ToneEnv, roles: Roles) => string;
    };
    swimlane: {
        render: (b: import("./types/sequence-table-swimlane.ts").LaidOutSwimlane & import("./types/core.ts").Dimmed, day: Theme, _tones: ToneEnv, roles: Roles) => string;
    };
    wireframe: {
        render: (b: import("./types/wireframe.ts").LaidOutWireframe & import("./types/core.ts").Dimmed, day: Theme) => string;
    };
    screens: {
        render: (b: import("./types/wireframe.ts").LaidOutScreens & import("./types/core.ts").Dimmed, day: Theme) => string;
    };
    sequence: {
        render: (b: import("./types/sequence-table-swimlane.ts").LaidOutSequence & import("./types/core.ts").Dimmed, day: Theme, tones: ToneEnv, roles: Roles) => string;
    };
    table: {
        render: (b: import("./types/sequence-table-swimlane.ts").LaidOutTable & import("./types/core.ts").Dimmed, day: Theme, tones: ToneEnv, roles: Roles) => string;
    };
    row: {
        render: (b: import("./types/containers.ts").LaidOutRow & import("./types/core.ts").Dimmed, day: Theme, tones: ToneEnv, roles: Roles, stage: number | undefined) => string;
        selfDimming: true;
    };
    grid: {
        render: (b: import("./types/containers.ts").LaidOutGrid & import("./types/core.ts").Dimmed, day: Theme, tones: ToneEnv, roles: Roles, stage: number | undefined) => string;
        selfDimming: true;
    };
    raw: {
        render: (b: import("./types/containers.ts").LaidOutRaw & import("./types/core.ts").Dimmed, day: Theme) => string;
    };
    pyramid: {
        render: (b: import("./types/figures.ts").LaidOutPyramid & import("./types/core.ts").Dimmed, _day: Theme, _tones: ToneEnv, roles: Roles) => string;
    };
    curve: {
        render: (b: import("./types/figures.ts").LaidOutCurve & import("./types/core.ts").Dimmed, day: Theme, tones: ToneEnv) => string;
    };
    plane: {
        render: (b: import("./types/figures.ts").LaidOutPlane & import("./types/core.ts").Dimmed, day: Theme, tones: ToneEnv, _roles: Roles, stage: number | undefined) => string;
    };
    quadrant: {
        render: (b: import("./quadrant.ts").LaidOutQuadrant & import("./types/core.ts").Dimmed, day: Theme, tones: ToneEnv) => string;
        selfDimming: true;
    };
    wordart: {
        render: (b: import("./wordart-types.ts").LaidOutWordArt & import("./types/core.ts").Dimmed, day: Theme) => string;
        selfDimming: true;
    };
    chevron: {
        render: (b: never, day: Theme, tones: ToneEnv) => string;
        selfDimming: true;
    };
    funnel: {
        render: (b: never, day: Theme, tones: ToneEnv) => string;
        selfDimming: true;
    };
    cycle: {
        render: (b: never, day: Theme, tones: ToneEnv) => string;
        selfDimming: true;
    };
    venn: {
        render: (b: never, day: Theme, tones: ToneEnv) => string;
        selfDimming: true;
    };
    concentric: {
        render: (b: never, day: Theme, tones: ToneEnv) => string;
        selfDimming: true;
    };
    emblem: {
        render: (b: never, day: Theme, tones: ToneEnv) => string;
        selfDimming: true;
    };
    bars: {
        render: (b: import("./types/bars.ts").LaidOutBars & import("./types/core.ts").Dimmed, day: Theme, _tones: ToneEnv, _roles: Roles, stage: number | undefined, dimFill: boolean) => string;
        selfDimming: true;
    };
    chart: {
        render: (b: import("./charts.ts").LaidOutChart & import("./types/core.ts").Dimmed, day: Theme, _tones: ToneEnv, _roles: Roles, stage: number | undefined, dimFill: boolean) => string;
        selfDimming: true;
    };
    image: {
        render: (b: import("./types/image.ts").LaidOutImage & import("./types/core.ts").Dimmed, day: Theme, tones: ToneEnv, _roles: Roles, stage: number | undefined) => string;
        selfDimming: true;
    };
    people: {
        render: (b: import("./types/people-dots.ts").LaidOutPeople & import("./types/core.ts").Dimmed, day: Theme, tones: ToneEnv) => string;
    };
    dots: {
        render: (b: import("./types/people-dots.ts").LaidOutDots & import("./types/core.ts").Dimmed, day: Theme, tones: ToneEnv) => string;
    };
    math: {
        render: (b: import("./types/math.ts").LaidOutMath & import("./types/core.ts").Dimmed) => string;
    };
    timeline: {
        render: (b: import("./types/timeline.ts").LaidOutTimeline & import("./types/core.ts").Dimmed, day: Theme) => string;
        selfDimming: true;
    };
    tree: {
        render: (b: import("./types/diagrams.ts").LaidOutTree & import("./types/core.ts").Dimmed, day: Theme, tones: ToneEnv) => string;
        selfDimming: true;
    };
    states: {
        render: (b: import("./types/diagrams.ts").LaidOutStates & import("./types/core.ts").Dimmed, day: Theme, tones: ToneEnv) => string;
        selfDimming: true;
    };
    cause: {
        render: (b: import("./types/diagrams.ts").LaidOutCause & import("./types/core.ts").Dimmed, day: Theme, tones: ToneEnv) => string;
        selfDimming: true;
    };
    cloud: {
        render: (b: import("./types/diagrams.ts").LaidOutCloud & import("./types/core.ts").Dimmed, day: Theme, tones: ToneEnv) => string;
        selfDimming: true;
    };
    gantt: {
        render: (b: import("./types/timeline.ts").LaidOutGantt & import("./types/core.ts").Dimmed, day: Theme) => string;
        selfDimming: true;
    };
    classes: {
        render: (b: import("./types/diagrams.ts").LaidOutClasses & import("./types/core.ts").Dimmed, day: Theme, tones: ToneEnv) => string;
        selfDimming: true;
    };
    bpmn: {
        render: (b: import("./types/diagrams.ts").LaidOutBpmn & import("./types/core.ts").Dimmed, day: Theme, tones: ToneEnv) => string;
        selfDimming: true;
    };
    fta: {
        render: (b: import("./types/diagrams.ts").LaidOutFta & import("./types/core.ts").Dimmed, day: Theme, tones: ToneEnv) => string;
        selfDimming: true;
    };
    bowtie: {
        render: (b: import("./types/diagrams.ts").LaidOutBowtie & import("./types/core.ts").Dimmed, day: Theme, tones: ToneEnv) => string;
        selfDimming: true;
    };
};
/** Band types with no emitter in EMIT_HANDLERS: must be `never`. */
export type UnemittedBandTypes = Exclude<LaidOutType, keyof typeof EMIT_HANDLERS>;
export declare const ALL_BANDS_EMITTED: UnemittedBandTypes extends never ? true : never;
export declare function renderBandPlain(band: LaidOutBand, day: Theme, tones: ToneEnv, roles: Roles, stage?: number, dimFill?: boolean): string;
export declare function renderBand(band: LaidOutBand, day: Theme, tones: ToneEnv, roles: Roles, stage?: number, dimFill?: boolean): string;
