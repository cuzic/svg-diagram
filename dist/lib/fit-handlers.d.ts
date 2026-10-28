import type { LaidOutType } from './band-table.ts';
import type { LaidOutBand } from './types/index.ts';
import type { WrappedRun } from './types/text-bands.ts';
export type TextSizes<B> = (band: B) => Iterable<number>;
/** A band's own text runs (what box / caption / banner carry); any band that has them. */
export declare const ownRunSizes: (band: LaidOutBand) => number[];
declare const childRuns: (band: {
    children: readonly {
        wrappedRuns: WrappedRun[];
    }[];
}) => number[];
export declare const FIT_HANDLERS: {
    caption: TextSizes<unknown>;
    status: (band: import("./types/containers.ts").LaidOutStatus & import("./types/core.ts").Dimmed) => number[];
    box: TextSizes<unknown>;
    banner: TextSizes<unknown>;
    group: TextSizes<unknown>;
    legend: TextSizes<unknown>;
    swimlane: TextSizes<unknown>;
    wireframe: TextSizes<unknown>;
    screens: TextSizes<unknown>;
    sequence: TextSizes<unknown>;
    table: (band: import("./types/sequence-table-swimlane.ts").LaidOutTable & import("./types/core.ts").Dimmed) => number[];
    row: typeof childRuns;
    grid: typeof childRuns;
    raw: TextSizes<unknown>;
    pyramid: TextSizes<unknown>;
    curve: TextSizes<unknown>;
    plane: (band: import("./types/figures.ts").LaidOutPlane & import("./types/core.ts").Dimmed) => number[];
    quadrant: TextSizes<{
        texts: readonly {
            size: number;
        }[];
    }>;
    chevron: TextSizes<{
        texts: readonly {
            size: number;
        }[];
    }>;
    wordart: (band: import("./wordart-types.ts").LaidOutWordArt & import("./types/core.ts").Dimmed) => number[];
    funnel: TextSizes<{
        texts: readonly {
            size: number;
        }[];
    }>;
    cycle: TextSizes<{
        texts: readonly {
            size: number;
        }[];
    }>;
    venn: TextSizes<{
        texts: readonly {
            size: number;
        }[];
    }>;
    concentric: TextSizes<{
        texts: readonly {
            size: number;
        }[];
    }>;
    emblem: TextSizes<{
        texts: readonly {
            size: number;
        }[];
    }>;
    bars: TextSizes<{
        texts: readonly {
            size: number;
        }[];
    }>;
    chart: (band: import("./charts.ts").LaidOutChart & import("./types/core.ts").Dimmed) => number[];
    image: (band: import("./types/image.ts").LaidOutImage & import("./types/core.ts").Dimmed) => number[];
    people: TextSizes<unknown>;
    dots: TextSizes<unknown>;
    math: TextSizes<unknown>;
    timeline: TextSizes<{
        texts: readonly {
            size: number;
        }[];
    }>;
    tree: TextSizes<{
        texts: readonly {
            size: number;
        }[];
    }>;
    states: TextSizes<{
        texts: readonly {
            size: number;
        }[];
        labels: readonly {
            size: number;
        }[];
    }>;
    cause: TextSizes<{
        texts: readonly {
            size: number;
        }[];
    }>;
    cloud: (band: import("./types/diagrams.ts").LaidOutCloud & import("./types/core.ts").Dimmed) => number[];
    gantt: TextSizes<{
        texts: readonly {
            size: number;
        }[];
    }>;
    classes: TextSizes<{
        texts: readonly {
            size: number;
        }[];
        labels: readonly {
            size: number;
        }[];
    }>;
    bpmn: TextSizes<{
        texts: readonly {
            size: number;
        }[];
        labels: readonly {
            size: number;
        }[];
    }>;
    fta: TextSizes<{
        texts: readonly {
            size: number;
        }[];
    }>;
    bowtie: TextSizes<{
        texts: readonly {
            size: number;
        }[];
    }>;
};
/** Band types with no entry in FIT_HANDLERS: must be `never`. */
export type UnfittedBandTypes = Exclude<LaidOutType, keyof typeof FIT_HANDLERS>;
export declare const ALL_BANDS_FITTED: UnfittedBandTypes extends never ? true : never;
/** Every text size one band draws: its own runs, then what its type adds. */
export declare function bandTextSizes(band: LaidOutBand): number[];
export {};
