import type {BranchTarget, ConnectBand, ConnectOpts, ConnectVia} from '../types/containers.ts';
import type {BranchInput, Ok, Refers} from '../strict.ts';
import {connectBand} from './defaults.ts';

// One box fanning out to several targets (a decision). `targets`:
// [{to, label?, tone?, dashed?}]; opts as connect() (route defaults to
// 'elbow'). Returns an array — d.add() flattens it.
export function branch<const F extends string, const To extends string>(from: Ok<F>, targets: (BranchInput & {to: Ok<To>})[], opts?: BranchInput): (ConnectBand & Refers<F | To>)[];
export function branch(from: string, targets: BranchTarget[], opts: ConnectOpts = {}): ConnectBand[] {
  // a target's via adds to the shared one (via: {from} on the fan and {to} on a target: both ends), it does not replace it
  return targets.map(t => Object.assign(connectBand(from, t.to, {route: 'elbow', ...opts, ...t, ...(opts.via !== undefined || t.via !== undefined ? {via: mergeVia(opts.via, t.via)} : {})}), {fan: true as const})); // assign, not spread: the band keeps the options it was written with (GIVEN)
}
function mergeVia(a: ConnectVia | undefined, b: ConnectVia | undefined): ConnectVia | undefined {
  if (a === undefined || b === undefined) return a ?? b;
  if (a === 'group' || b === 'group') return 'group';
  return {...a, ...Object.fromEntries(Object.entries(b).filter(([, v]) => v !== undefined))};
}
