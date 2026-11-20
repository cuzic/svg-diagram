import type { RenderedSlide } from './render-deck.ts';
export interface PublishTarget {
    origin: string;
    token: string;
    deckFile: string;
}
export interface PublishRecord {
    origin: string;
    deck: string;
    id: string;
    presenterTokens: string[];
}
export interface Limits {
    maxSlides: number;
    maxSlideBytes: number;
    maxDeckBytes: number;
}
export declare function readRecord(t: PublishTarget): PublishRecord | null;
export declare class PublishError extends Error {
}
/** The Worker's limits, after checking it speaks the same protocol and takes this PUBLISH_TOKEN. */
export declare function workerLimits(t: PublishTarget): Promise<Limits>;
/** What breaks the Worker's limits, each with its slide: checked here, before anything is sent. */
export declare function overLimits(slides: readonly RenderedSlide[], limits: Limits): string[];
/** The presentation for this Worker and deck: the one made before, or a new one. */
export declare function ensurePresentation(t: PublishTarget): Promise<{
    record: PublishRecord;
    created: boolean;
}>;
/** The slides sent: first without the SVGs, then with the ones the Worker does not hold. Returns the Worker's version of the deck. */
export declare function pushSlides(t: PublishTarget, record: PublishRecord, title: string, slides: readonly RenderedSlide[]): Promise<number>;
export declare function deletePresentation(t: PublishTarget): Promise<boolean>;
export declare function newPresenterToken(t: PublishTarget): Promise<string>;
export declare function revokePresenterTokens(t: PublishTarget): Promise<void>;
export declare const viewerUrlOf: (r: PublishRecord) => string;
export declare const presenterUrlOf: (r: PublishRecord, token: string) => string;
