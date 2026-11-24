import type {BandDef} from './band-def.ts';
import {resolveAnchor} from './scope-table.ts';
import type {ScopeTable} from './scope-table.ts';
import type {RevealOpts} from './types/core.ts';
import type {Band} from './types/index.ts';

export type RevealStage = {start: number; end?: number};
export type RevealAnchor = RevealStage & {band?: Band};
export type RevealWarningCheck = (ids: ReadonlyMap<string, RevealAnchor>, scopes: ScopeTable, warnings: string[]) => void;

/** A reveal check deferred until all anchors are known. */
export type RevealElements = ReturnType<NonNullable<BandDef['revealElements']>> & {
  checkEndpoints?: RevealWarningCheck;
};

export function warnEarlyReveal(warnings: string[], what: string, explicit: number | undefined, endpoint: number): void {
  if (explicit !== undefined && explicit < endpoint) warnings.push(`${what} reveal ${explicit} is earlier than an endpoint (reveal ${endpoint})`);
}

export function resolveRevealId(scopes: ScopeTable, ref: string, known: (id: string) => boolean): string {
  const id = ref.split(':')[0] ?? ref;
  return resolveAnchor(scopes, id, known) ?? id;
}

export function warnConnectorReveal(warnings: string[], {from, to, reveal, until}: RevealOpts & {from: string; to: string}, endpoints: RevealStage): void {
  const what = `connect(${from} -> ${to})`;
  warnEarlyReveal(warnings, what, reveal, endpoints.start);
  const end = endpoints.end ?? Infinity;
  if (until !== undefined && until > end) {
    warnings.push(`${what} until ${until} is later than an endpoint's (vanishes at ${end})`);
  }
}
