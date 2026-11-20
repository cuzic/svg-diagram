import type { ConnectBand } from '../types/containers.ts';
import type { Band } from '../types/index.ts';
/** The look of a band: the only things a rewrite may change. Not text, icon, id, children or a connector's ends. */
export interface BandPatch {
    tone?: string;
    dashed?: boolean;
    titleTone?: string;
    bodyTone?: string;
    noteTone?: string;
    iconTone?: string;
    align?: string;
    bold?: boolean;
    mono?: boolean;
    line?: ConnectBand['line'];
    arrow?: ConnectBand['arrow'];
    weight?: 'strong';
    reveal?: number;
    until?: number;
}
/** What a rule returns for a band: a patch, or undefined to leave it. `path` is the bands around it, outermost first. */
export type RewriteFn = (band: Band, path: readonly Band[]) => BandPatch | undefined;
export type Predicate = (band: Band, path: readonly Band[]) => boolean;
/**
 * Every band, then the bands inside it (a patched band's children too), gets one call to `fn`; a band it patches is copied, the
 * rest are the same objects (nothing is copied when nothing changes). Reaches group / row / grid children and the band nodes of
 * a tree() (the tree is in `path`).
 */
type Seen = Map<Band, {
    path: readonly Band[];
    out: Band;
}[]>;
export declare function rewrite(bands: Band[], fn: RewriteFn, path?: readonly Band[], seen?: Seen): Band[];
/** A band of one of these types. */
export declare const isType: (...types: Band['type'][]) => Predicate;
/** A band that sits inside a band of this type (any depth). */
export declare const within: (type: Band['type']) => Predicate;
/** `when(isType('box'), {tone: 'muted'})`: the patch for the bands every predicate holds for. */
export declare const when: (pred: Predicate | Predicate[], patch: BandPatch) => RewriteFn;
export {};
