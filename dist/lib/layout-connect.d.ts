import type { ScopeTable } from './anchor-scope.ts';
import type { ConnectBand, LaidOutConnect } from './types/containers.ts';
import type { ConnectRef, Rect, Roles, WidthOf } from './types/core.ts';
export declare function parseRef(ref: string): ConnectRef;
/**
 * A reference as written, with its id turned into the name the anchor is registered under (ADR 0012): a qualified name is itself,
 * a bare id that only one scoped item answers to is that item's qualified name, and one several answer to throws. Without scoped
 * items (the usual case) the reference comes back as it is.
 */
export declare function resolveRef(ref: string, anchors: ReadonlyMap<string, Rect>, scopes?: ScopeTable): ConnectRef;
export declare function resolveConnect(band: ConnectBand, anchors: Map<string, Rect>, areaIds: Set<string>, widthOf: WidthOf, roles: Roles, nodeBottoms?: Map<string, number>, scopes?: ScopeTable): LaidOutConnect;
