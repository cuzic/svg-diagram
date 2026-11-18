/** The version of what `--publish` and the Worker send each other; they refuse each other when it differs (ADR 0056 D11). */
export declare const PROTOCOL = 2;
/** The one state of a presentation: `epoch` is the server's (a local start, a Worker presentation), `seq` counts the moves, `version` the deck's. */
export interface SyncState {
    epoch: string;
    seq: number;
    index: number;
    version: number;
}
/** What a presenter sends: a step (next / previous, summed in order) or a slide to go to. */
export type GoMessage = {
    type: 'go';
    delta: number;
} | {
    type: 'go';
    index: number;
};
/** What every client is sent when the state changes: the state, the current slide's URL and what it says (for <img alt>). */
export interface StateMessage extends SyncState {
    type: 'state';
    slide: string;
    alt: string;
    total: number; /** Someone has moved since this server started: a presenter's page puts back its slide only while this is false. */
    moved: boolean;
    /** Linked (ADR 0062): a presenter's move brings every viewer to the presenter's slide; unlinked, viewers stay where they are. */ linked: boolean;
}
/** What else a presenter sends (ADR 0062): linking on or off, and the laser pointer (x, y in 0..1 over the slide `index`; off: hidden). */
export type LinkMessage = {
    type: 'link';
    on: boolean;
};
/** `spot` (ADR 0064): a spotlight of radius `r` (a share of the slide's width) instead of the laser's dot. */
export type PointerMessage = {
    type: 'pointer';
    index: number;
    x: number;
    y: number;
    spot?: true;
    r?: number;
} | {
    type: 'pointer';
    off: true;
};
/** The presenter's zoom (ADR 0063): `z` times (1 is the whole slide) around (x, y) in 0..1 of the slide `index`; passed on, not kept. */
export type ZoomMessage = {
    type: 'zoom';
    index: number;
    z: number;
    x: number;
    y: number;
};
/** The largest zoom. */
export declare const MAX_ZOOM = 6;
export type PresenterMessage = GoMessage | LinkMessage | PointerMessage | ZoomMessage;
/** A presenter's message of any kind, or null (anything else is dropped). */
export declare function parsePresenter(raw: unknown): PresenterMessage | null;
/** At most this many pointer messages per presenter connection per second; the rest are dropped (a pointer moves often, a slide does not). */
export declare const POINTER_PER_SECOND = 30;
/** A presenter's go, or null when `raw` is anything else (a viewer's or a malformed message is dropped, not answered). */
export declare function parseGo(raw: unknown): GoMessage | null;
/** The state after `go` on a deck of `total` slides, or null when it does not move (nothing to send). */
export declare function applyGo(s: SyncState, go: GoMessage, total: number): SyncState | null;
/** Whether a client that holds `held` takes `got`: a new epoch replaces everything; within one, only a later move (an old message never moves it back). */
export declare function takes(held: {
    epoch: string;
    seq: number;
} | null, got: {
    epoch: string;
    seq: number;
}): boolean;
/**
 * Where the current slide is once the deck has changed (ADR 0056 D6): the slide with the same content (hash), else the same heading, else
 * the same number kept within the deck, so a slide added or removed before it does not move everyone to a different slide.
 */
export declare function followIndex(before: readonly {
    hash: string;
    title: string;
}[], after: readonly {
    hash: string;
    title: string;
}[], index: number): number;
/** At most this many gos per presenter connection per second; the rest are dropped (ADR 0056 D6). */
export declare const GO_PER_SECOND = 10;
/** Whether a go at `now` (ms) fits the presenter's recent gos `times` (kept in place: the times within the last second). */
export declare function allowGo(times: number[], now: number, perSecond?: number): boolean;
/** Reconnecting (ADR 0056 D6): 0.5 s first, doubled each failure up to 30 s, each moved by ±50 % (`random` in [0, 1)). */
export declare function reconnectDelay(failures: number, random: number): number;
/** A connection that has held this long counts as good again: the next failure waits 0.5 s. */
export declare const STABLE_MS = 10000;
