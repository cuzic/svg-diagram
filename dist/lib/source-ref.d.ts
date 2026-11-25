export { captureSourceLocations } from './source-capture.ts';
export declare const SOURCE: unique symbol;
export declare const DIAGRAM_SOURCE: unique symbol;
/** A lazy V8 stack, or the path of a spec part. Copies of a part share this reference. */
export declare class SourceRef {
    readonly stackHolder?: {
        stack?: string;
    };
    readonly specPath?: string;
    constructor(stackHolder?: {
        stack?: string;
    }, specPath?: string);
}
export declare function captureHere(skip?: Parameters<ErrorConstructor['captureStackTrace']>[1]): SourceRef | undefined;
type SourceKey = typeof SOURCE | typeof DIAGRAM_SOURCE;
export declare function sourceOf(target: object, key?: SourceKey): SourceRef | undefined;
/** Associate every band from a spec part with its path, preserving distinct builder call sites. */
export declare function markSpecPart(bands: Iterable<object>, path: string): void;
/** Preserve a more specific source already assigned by an inner operation. */
export declare function withSource<T extends object>(target: T, ref: SourceRef | undefined, key?: SourceKey): T;
export declare function atBand<T>(band: object, fn: () => T): T;
export declare function throwAtDiagram(e: unknown, diagram: object): never;
