import type { ConnectBand } from './types/containers.ts';
import type { BandDef } from './band-def.ts';
import type { ScopeTable } from './scope-table.ts';
import type { RevealOpts } from './types/core.ts';
import type { Band } from './types/index.ts';
export type RevealStage = {
    start: number;
    end?: number;
};
export type RevealAnchor = RevealStage & {
    band?: Band;
};
export type RevealWarningCheck = (ids: ReadonlyMap<string, RevealAnchor>, scopes: ScopeTable, warnings: string[]) => void;
/** A reveal check deferred until all anchors are known. */
export type RevealElements = ReturnType<NonNullable<BandDef['revealElements']>> & {
    checkEndpoints?: RevealWarningCheck;
};
export declare function warnEarlyReveal(warnings: string[], what: string, explicit: number | undefined, endpoint: number): void;
export declare function resolveRevealId(scopes: ScopeTable, ref: string, known: (id: string) => boolean): string;
export declare function warnConnectorReveal(warnings: string[], { from, to, reveal, until }: RevealOpts & {
    from: string;
    to: string;
}, endpoints: RevealStage): void;
export type Revealed = {
    reveal?: number;
    until?: number;
    id?: string;
};
/** Context type for the reveal hook declared by BandDef. */
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
    connects: ConnectBand[];
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
