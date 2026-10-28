import type { Band } from './types/index.ts';
type BandOf<T extends Band['type']> = Extract<Band, {
    type: T;
}>;
export type Revealed = {
    reveal?: number;
    until?: number;
    id?: string;
};
export declare function checked(value: number | undefined, where: string): number | undefined;
export declare const earlier: (a: number | undefined, b: number | undefined) => number | undefined;
/** The state one prepareReveal() run threads through its handlers. */
export interface RevealCtx {
    /** element / node id -> the stage it appears at */
    ids: Map<string, number>;
    /** element / node id -> the stage it vanishes at */
    untils: Map<string, number>;
    /** a bar's own `until`, as written (before the band's is merged in) */
    ownUntils: Map<object, number | undefined>;
    /** ids of bars that another bar already replaces */
    replaced: Set<string>;
    warnings: string[];
    connects: BandOf<'connect'>[];
    /** the largest stage (or until) seen so far */
    max: number;
    /** The `scope` of the band whose items are being visited (ADR 0012); undefined for the band itself and for unscoped bands. */
    scope?: string;
    /** The name an item id is registered under: `scope.id` inside a scoped band, the id itself elsewhere. */
    name(id: string): string;
    /** Resolve one element: max(inherited, own) reveal, earliest until; records its id. Returns its stage. */
    set(x: Revealed, inherited: number, where: string, inheritedUntil?: number): number;
    /** Walk nested bands with an inherited stage / until. */
    walk(bands: Band[], inherited?: number, until?: number): void;
}
/**
 * How a band type takes part in the walk. `stage: false`: it has no reveal of its own (a connect() is resolved last, from the
 * stages of its ends; a legend / spacer never reveals) and only `visit` runs. `stage: true`: the band itself is resolved first
 * (n = its stage, u = its until) and then `visit` handles what it holds.
 */
export type RevealHandler<B> = {
    stage: false;
    visit?(band: B, ctx: RevealCtx): void;
} | {
    stage: true;
    visit?(band: B, n: number, u: number | undefined, ctx: RevealCtx): void;
};
export type BandRevealHandlers = {
    [T in Band['type']]: RevealHandler<BandOf<T>>;
};
declare function revealPlane(p: BandOf<'plane'>, n: number, _u: number | undefined, ctx: RevealCtx): void;
declare function revealRow(b: BandOf<'row'> | BandOf<'grouprow'>, n: number, u: number | undefined, ctx: RevealCtx): void;
declare function revealImage(b: BandOf<'image'>, n: number, u: number | undefined, ctx: RevealCtx): void;
declare function revealBars(b: BandOf<'bars'>, n: number, u: number | undefined, ctx: RevealCtx): void;
/**
 * The handler of every band type. Typed per key (the `satisfies` below), so each is checked against its own band type;
 * UnrevealedBandTypes makes a band type without one a compile error.
 */
export declare const REVEAL_HANDLERS: {
    spacer: {
        stage: false;
        visit?(band: never, ctx: RevealCtx): void;
    };
    status: {
        stage: false;
        visit?(band: never, ctx: RevealCtx): void;
    };
    group: {
        stage: true;
        visit?(band: Band, n: number, u: number | undefined, ctx: RevealCtx): void;
    };
    sequence: {
        stage: true;
        visit?(band: never, n: number, u: number | undefined, ctx: RevealCtx): void;
    };
    table: {
        stage: true;
        visit?(band: never, n: number, u: number | undefined, ctx: RevealCtx): void;
    };
    image: {
        stage: true;
        visit: typeof revealImage;
    };
    timeline: {
        stage: true;
        visit?(band: never, n: number, u: number | undefined, ctx: RevealCtx): void;
    };
    bpmn: {
        stage: true;
        visit?(band: never, n: number, u: number | undefined, ctx: RevealCtx): void;
    };
    fta: {
        stage: true;
        visit?(band: never, n: number, u: number | undefined, ctx: RevealCtx): void;
    };
    bowtie: {
        stage: true;
        visit?(band: never, n: number, u: number | undefined, ctx: RevealCtx): void;
    };
    classes: {
        stage: true;
        visit?(band: never, n: number, u: number | undefined, ctx: RevealCtx): void;
    };
    gantt: {
        stage: true;
        visit?(band: never, n: number, u: number | undefined, ctx: RevealCtx): void;
    };
    cause: {
        stage: true;
        visit?(band: never, n: number, u: number | undefined, ctx: RevealCtx): void;
    };
    cloud: {
        stage: true;
        visit?(band: never, n: number, u: number | undefined, ctx: RevealCtx): void;
    };
    states: {
        stage: true;
        visit?(band: never, n: number, u: number | undefined, ctx: RevealCtx): void;
    };
    tree: {
        stage: true;
        visit?(band: never, n: number, u: number | undefined, ctx: RevealCtx): void;
    };
    bars: {
        stage: true;
        visit: typeof revealBars;
    };
    chart: {
        stage: true;
        visit?(band: never, n: number, u: number | undefined, ctx: RevealCtx): void;
    };
    people: {
        stage: true;
        visit?(band: never, n: number, u: number | undefined, ctx: RevealCtx): void;
    };
    dots: {
        stage: true;
        visit?(band: never, n: number, u: number | undefined, ctx: RevealCtx): void;
    };
    math: {
        stage: true;
        visit?(band: never, n: number, u: number | undefined, ctx: RevealCtx): void;
    };
    wireframe: {
        stage: true;
        visit?(band: never, n: number, u: number | undefined, ctx: RevealCtx): void;
    };
    screens: {
        stage: true;
        visit?(band: never, n: number, u: number | undefined, ctx: RevealCtx): void;
    };
    swimlane: {
        stage: true;
        visit: (b: never, n: number, u: number | undefined, ctx: RevealCtx) => void;
    };
    legend: {
        stage: false;
        visit?(band: never, ctx: RevealCtx): void;
    };
    connect: {
        stage: false;
        visit: (b: import("./types/containers.ts").ConnectBand, ctx: RevealCtx) => void;
    };
    raw: {
        stage: true;
        visit?(band: never, n: number, u: number | undefined, ctx: RevealCtx): void;
    };
    grouprow: {
        stage: true;
        visit: typeof revealRow;
    };
    row: {
        stage: true;
        visit: typeof revealRow;
    };
    grid: {
        stage: true;
        visit: (b: never, n: number, u: number | undefined, ctx: RevealCtx) => void;
    };
    pyramid: {
        stage: true;
        visit?(band: never, n: number, u: number | undefined, ctx: RevealCtx): void;
    };
    plane: {
        stage: true;
        visit: typeof revealPlane;
    };
    quadrant: {
        stage: true;
        visit?(band: never, n: number, u: number | undefined, ctx: RevealCtx): void;
    };
    chevron: {
        stage: true;
        visit?(band: never, n: number, u: number | undefined, ctx: RevealCtx): void;
    };
    wordart: {
        stage: true;
        visit?(band: never, n: number, u: number | undefined, ctx: RevealCtx): void;
    };
    funnel: {
        stage: true;
        visit?(band: never, n: number, u: number | undefined, ctx: RevealCtx): void;
    };
    cycle: {
        stage: true;
        visit?(band: never, n: number, u: number | undefined, ctx: RevealCtx): void;
    };
    venn: {
        stage: true;
        visit?(band: never, n: number, u: number | undefined, ctx: RevealCtx): void;
    };
    concentric: {
        stage: true;
        visit?(band: never, n: number, u: number | undefined, ctx: RevealCtx): void;
    };
    emblem: {
        stage: true;
        visit?(band: never, n: number, u: number | undefined, ctx: RevealCtx): void;
    };
    curve: {
        stage: true;
        visit?(band: never, n: number, u: number | undefined, ctx: RevealCtx): void;
    };
    caption: {
        stage: true;
        visit?(band: never, n: number, u: number | undefined, ctx: RevealCtx): void;
    };
    box: {
        stage: true;
        visit?(band: never, n: number, u: number | undefined, ctx: RevealCtx): void;
    };
    banner: {
        stage: true;
        visit?(band: never, n: number, u: number | undefined, ctx: RevealCtx): void;
    };
};
/** Band types with no handler in REVEAL_HANDLERS: must be `never`, so adding a band type without one fails to compile. */
export type UnrevealedBandTypes = Exclude<Band['type'], keyof typeof REVEAL_HANDLERS>;
export declare const ALL_BANDS_REVEALED: UnrevealedBandTypes extends never ? true : never;
export declare function revealHandlerFor(band: Band): RevealHandler<never>;
export {};
