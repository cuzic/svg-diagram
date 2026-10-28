import type { ToneEnv } from './tokens.ts';
import type { LaidOutOf, LaidOutType } from './band-table.ts';
import type { Rect } from './types/core.ts';
import type { LaidOutDiagram } from './types/index.ts';
import type { LaidOutBanner, LaidOutBox, LaidOutCaption } from './types/text-bands.ts';
import type { CheckRect } from './types/verdicts.ts';
/** Where a band's findings go: `problems` fail the build, `warnings` never do. */
export interface VerifyOut {
    problems: string[];
    warnings: string[];
}
/**
 * The order the figure checks run in: every phase goes over all the bands, then the next one starts, so the findings of one kind
 * stay together (and in band order) whichever band types produce them.
 */
export declare const CHECK_PHASES: readonly ['plane', 'quadrant', 'flow', 'wordart', 'bars', 'chart', 'image', 'timeline', 'states', 'cause', 'cloud', 'gantt', 'classes', 'bpmn', 'nowrap'];
export type CheckPhase = typeof CHECK_PHASES[number];
export interface VerifyHandler<B> {
    rects?(band: B): CheckRect[];
    check?: {
        phase: CheckPhase;
        run(band: B, d: LaidOutDiagram, out: VerifyOut, tones: ToneEnv): void;
    };
    contrast?(band: B, d: LaidOutDiagram, tones: ToneEnv): string[];
}
type Anchored = Rect & {
    id?: string;
    anchors: (Rect & {
        id: string;
    })[];
};
declare const figureRects: (band: Anchored) => CheckRect[];
/** An emblem's obstacle is the bounding box of each shape, not its anchor: a triangle's anchor leaves out its lower corners. */
declare const emblemRects: (band: Anchored & {
    bounds?: Anchored['anchors'];
}) => CheckRect[];
declare const overlappingFigureRects: (band: Anchored) => CheckRect[];
declare const ownRect: (band: Rect & {
    id?: string;
}) => CheckRect[];
declare const frameRects: (band: {
    anchors: (Rect & {
        id: string;
    })[];
}) => CheckRect[];
declare const childRects: (band: {
    children: (Rect & {
        id?: string;
    })[];
}) => CheckRect[];
declare const checkTimeline: (band: LaidOutOf<'timeline'>, _d: LaidOutDiagram, { problems }: VerifyOut) => void;
declare const checkStates: (band: LaidOutOf<'states'>, _d: LaidOutDiagram, { problems }: VerifyOut) => void;
declare const checkGantt: (band: LaidOutOf<'gantt'>, _d: LaidOutDiagram, { problems }: VerifyOut) => void;
declare const checkClasses: (band: LaidOutOf<'classes'>, _d: LaidOutDiagram, { problems }: VerifyOut) => void;
declare const checkBpmn: (band: LaidOutOf<'bpmn'>, _d: LaidOutDiagram, { problems }: VerifyOut) => void;
declare const checkCause: (band: LaidOutOf<'cause'>, _d: LaidOutDiagram, { problems, warnings }: VerifyOut) => void;
declare const checkCloud: (band: LaidOutOf<'cloud'>, _d: LaidOutDiagram, { problems }: VerifyOut) => void;
declare const checkBars: (band: LaidOutOf<'bars'>, _d: LaidOutDiagram, { problems }: VerifyOut) => void;
declare const checkImage: (band: LaidOutOf<'image'>, _d: LaidOutDiagram, { problems }: VerifyOut) => void;
declare const checkQuadrant: (band: LaidOutOf<'quadrant'>, _d: LaidOutDiagram, { problems }: VerifyOut) => void;
declare const checkFlowShape: (band: LaidOutOf<'chevron' | 'funnel' | 'cycle' | 'venn' | 'concentric' | 'emblem'>, _d: LaidOutDiagram, { problems }: VerifyOut) => void;
declare const checkWordArt: (band: LaidOutOf<'wordart'>, d: LaidOutDiagram, { problems }: VerifyOut, tones: ToneEnv) => void;
declare const checkPlane: (band: LaidOutOf<'plane'>, _d: LaidOutDiagram, { problems }: VerifyOut) => void;
declare function barsContrast(band: LaidOutOf<'bars'>, d: LaidOutDiagram, tones: ToneEnv): string[];
declare function imageContrast(band: LaidOutOf<'image'>, d: LaidOutDiagram, tones: ToneEnv): string[];
export declare const VERIFY_HANDLERS: {
    caption: {
        rects: (band: LaidOutCaption & import("./types/core.ts").Dimmed) => {
            x: number;
            y: number;
            w: number;
            h: number;
            id: null;
            label: string;
        }[];
        contrast: (band: LaidOutCaption & import("./types/core.ts").Dimmed, d: LaidOutDiagram, tones: ToneEnv) => string[];
    };
    box: {
        rects: typeof ownRect;
        check: {
            phase: "nowrap";
            run: (band: LaidOutBox & import("./types/core.ts").Dimmed, _d: LaidOutDiagram, out: VerifyOut) => void;
        };
        contrast: (band: LaidOutBox & import("./types/core.ts").Dimmed, d: LaidOutDiagram, tones: ToneEnv) => string[];
    };
    banner: {
        rects: typeof ownRect;
        contrast: (band: LaidOutBanner & import("./types/core.ts").Dimmed, d: LaidOutDiagram, tones: ToneEnv) => string[];
    };
    group: {};
    legend: {
        rects: typeof ownRect;
    };
    row: {
        rects: typeof childRects;
        check: {
            phase: "nowrap";
            run: (band: import("./types/containers.ts").LaidOutRow & import("./types/core.ts").Dimmed, _d: LaidOutDiagram, out: VerifyOut) => void;
        };
        contrast: (band: import("./types/containers.ts").LaidOutRow & import("./types/core.ts").Dimmed, d: LaidOutDiagram, tones: ToneEnv) => string[];
    };
    grid: {
        rects: typeof childRects;
        check: {
            phase: "nowrap";
            run: (band: import("./types/containers.ts").LaidOutGrid & import("./types/core.ts").Dimmed, _d: LaidOutDiagram, out: VerifyOut) => void;
        };
        contrast: (band: import("./types/containers.ts").LaidOutGrid & import("./types/core.ts").Dimmed, d: LaidOutDiagram, tones: ToneEnv) => string[];
    };
    raw: {
        rects: typeof ownRect;
    };
    status: {
        rects: (band: import("./types/containers.ts").LaidOutStatus & import("./types/core.ts").Dimmed) => {
            x: number;
            y: number;
            w: number;
            h: number;
            id: null;
            label: string;
        }[];
    };
    pyramid: {
        rects: typeof ownRect;
    };
    curve: {
        rects: typeof ownRect;
    };
    plane: {
        rects: typeof ownRect;
        check: {
            phase: "plane";
            run: typeof checkPlane;
        };
    };
    bars: {
        rects: (band: import("./types/bars.ts").LaidOutBars & import("./types/core.ts").Dimmed) => {
            id: string | null;
            label: string;
            x: number;
            y: number;
            w: number;
            h: number;
            life?: {
                reveal: number | undefined;
                until: number | undefined;
            } | undefined;
        }[];
        check: {
            phase: "bars";
            run: typeof checkBars;
        };
        contrast: typeof barsContrast;
    };
    chart: {
        rects: (band: import("./charts.ts").LaidOutChart & import("./types/core.ts").Dimmed) => ({
            holds: string[];
            id: string;
            label: string;
            x: number;
            y: number;
            w: number;
            h: number;
        } | {
            holds?: undefined;
            id: string;
            label: string;
            x: number;
            y: number;
            w: number;
            h: number;
        })[];
        check: {
            phase: "chart";
            run: (band: import("./charts.ts").LaidOutChart & import("./types/core.ts").Dimmed, d: LaidOutDiagram, { problems }: VerifyOut, tones: ToneEnv) => void;
        };
    };
    image: {
        rects: (band: import("./types/image.ts").LaidOutImage & import("./types/core.ts").Dimmed) => {
            id: string | null;
            label: string;
            x: number;
            y: number;
            w: number;
            h: number;
            holds: string[];
            backdrop?: true | undefined;
        }[];
        check: {
            phase: "image";
            run: typeof checkImage;
        };
        contrast: typeof imageContrast;
    };
    people: {
        rects: typeof ownRect;
    };
    dots: {
        rects: typeof ownRect;
    };
    math: {
        rects: typeof ownRect;
    };
    quadrant: {
        rects: typeof figureRects;
        check: {
            phase: "quadrant";
            run: typeof checkQuadrant;
        };
    };
    chevron: {
        rects: typeof figureRects;
        check: {
            readonly phase: 'flow';
            readonly run: typeof checkFlowShape;
        };
    };
    wordart: {
        rects: typeof ownRect;
        check: {
            phase: "wordart";
            run: typeof checkWordArt;
        };
    };
    funnel: {
        rects: typeof figureRects;
        check: {
            readonly phase: 'flow';
            readonly run: typeof checkFlowShape;
        };
    };
    cycle: {
        rects: typeof figureRects;
        check: {
            readonly phase: 'flow';
            readonly run: typeof checkFlowShape;
        };
    };
    venn: {
        rects: typeof overlappingFigureRects;
        check: {
            readonly phase: 'flow';
            readonly run: typeof checkFlowShape;
        };
    };
    concentric: {
        rects: typeof overlappingFigureRects;
        check: {
            readonly phase: 'flow';
            readonly run: typeof checkFlowShape;
        };
    };
    emblem: {
        rects: typeof emblemRects;
        check: {
            readonly phase: 'flow';
            readonly run: typeof checkFlowShape;
        };
    };
    timeline: {
        rects: typeof ownRect;
        check: {
            phase: "timeline";
            run: typeof checkTimeline;
        };
    };
    bowtie: {
        rects: (band: import("./types/diagrams.ts").LaidOutBowtie & import("./types/core.ts").Dimmed) => ({
            holds: string[];
            id: null;
            label: string;
            x: number;
            y: number;
            w: number;
            h: number;
        } | {
            holds?: undefined;
            id: null;
            label: string;
            x: number;
            y: number;
            w: number;
            h: number;
        })[];
    };
    fta: {
        rects: (band: import("./types/diagrams.ts").LaidOutFta & import("./types/core.ts").Dimmed) => ({
            holds: string[];
            id: string | null;
            label: string;
            x: number;
            y: number;
            w: number;
            h: number;
        } | {
            holds?: undefined;
            id: string | null;
            label: string;
            x: number;
            y: number;
            w: number;
            h: number;
        })[];
    };
    tree: {
        rects: (band: import("./types/diagrams.ts").LaidOutTree & import("./types/core.ts").Dimmed) => ({
            holds: string[];
            id: string | null;
            label: string;
            x: number;
            y: number;
            w: number;
            h: number;
        } | {
            holds?: undefined;
            id: string | null;
            label: string;
            x: number;
            y: number;
            w: number;
            h: number;
        })[];
    };
    states: {
        rects: typeof figureRects;
        check: {
            phase: "states";
            run: typeof checkStates;
        };
    };
    cause: {
        rects: typeof figureRects;
        check: {
            phase: "cause";
            run: typeof checkCause;
        };
    };
    cloud: {
        rects: (band: import("./types/diagrams.ts").LaidOutCloud & import("./types/core.ts").Dimmed) => ({
            holds: string[];
            id: string | null;
            label: string;
            x: number;
            y: number;
            w: number;
            h: number;
        } | {
            holds?: undefined;
            id: string | null;
            label: string;
            x: number;
            y: number;
            w: number;
            h: number;
        })[];
        check: {
            phase: "cloud";
            run: typeof checkCloud;
        };
    };
    gantt: {
        rects: typeof figureRects;
        check: {
            phase: "gantt";
            run: typeof checkGantt;
        };
    };
    classes: {
        rects: typeof figureRects;
        check: {
            phase: "classes";
            run: typeof checkClasses;
        };
    };
    bpmn: {
        rects: typeof figureRects;
        check: {
            phase: "bpmn";
            run: typeof checkBpmn;
        };
    };
    swimlane: {};
    sequence: {
        rects: typeof ownRect;
    };
    table: {
        rects: typeof ownRect;
    };
    wireframe: {
        rects: typeof ownRect;
    };
    screens: {
        rects: typeof frameRects;
    };
};
/** Band types with no entry in VERIFY_HANDLERS: must be `never`. */
export type UnverifiedBandTypes = Exclude<LaidOutType, keyof typeof VERIFY_HANDLERS>;
export declare const ALL_BANDS_VERIFIED: UnverifiedBandTypes extends never ? true : never;
/** Every checkable rect, in band order. */
export declare function collectRects(d: LaidOutDiagram): CheckRect[];
/** The figure checks of one phase, over every band in order. */
export declare function runCheckPhase(d: LaidOutDiagram, tones: ToneEnv, phase: CheckPhase, out: VerifyOut): void;
/** The contrast problems of every band, in band order. */
export declare function contrastProblems(d: LaidOutDiagram, tones: ToneEnv): string[];
export {};
