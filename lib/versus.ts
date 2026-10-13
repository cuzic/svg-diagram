import {connect, group, row, spacer} from './dsl.ts';
import type {Arrow, Band, BandInput, BoxTone, Route, ConnectBand, GroupBand, GroupRowBand, SpacerBand} from './types.ts';
import type {Declares, IdsOf, Refers, RefsOf} from './strict.ts';

export interface VersusPart<C extends BandInput = BandInput, Id extends string = string> {
  children: C;
  title?: string;
  tone?: BoxTone;
  /** How an array of children is laid out: 'column' (default, stacked) or 'row' (side by side, equal widths). */
  direction?: 'column' | 'row';
  id?: Id;
  /** Stage the whole side (frame and contents) appears at. The arrows to the shared part follow the later of their two ends. */
  reveal?: number;
}

export interface VersusConnectLabels {
  left?: string;
  right?: string;
}

export interface VersusOpts {
  shared?: undefined;
}

export interface VersusSharedOpts<C extends BandInput = BandInput, Id extends string = string> {
  shared: VersusPart<C, Id> & {id: Id};
  connectLabels?: VersusConnectLabels;
  /** Route of the two connectors (default 'straight'). Each drops plumb from the middle of its side onto the shared frame, so both routes draw a vertical line. */
  connectRoute?: Route;
  /** Arrowhead of the two connectors (default 'end'; 'none' for a plain line). */
  connectArrow?: Arrow;
}

type VersusBands = (GroupRowBand | GroupBand | ConnectBand | SpacerBand)[];
type VersusResult<LC, RC, LI extends string, RI extends string, SC = never, SI extends string = never> =
  ((GroupRowBand | GroupBand | ConnectBand | SpacerBand)
    & Declares<IdsOf<LC> | IdsOf<RC> | IdsOf<SC> | LI | RI | SI>
    & Refers<RefsOf<LC> | RefsOf<RC> | RefsOf<SC>>)[];

function asGroup<C extends BandInput, Id extends string>(part: VersusPart<C, Id>): GroupBand & Declares<IdsOf<C> | Id> & Refers<RefsOf<C>> {
  if (part.direction !== undefined && part.direction !== 'column' && part.direction !== 'row') throw new Error(`versus(): direction must be 'column' or 'row' (got ${String(part.direction)})`);
  const kids = part.children as Band | Band[];
  const children = part.direction === 'row' && Array.isArray(kids) && kids.length > 1 ? row(kids as never, {cols: 12}) as Band : kids;
  return group(children, {title: part.title, tone: part.tone, id: part.id, reveal: part.reveal});
}

export function versus<LC extends BandInput, RC extends BandInput, const LI extends string = never, const RI extends string = never>(
  left: VersusPart<LC, LI>, right: VersusPart<RC, RI>, opts?: VersusOpts,
): VersusResult<LC, RC, LI, RI>;
export function versus<LC extends BandInput, RC extends BandInput, SC extends BandInput, const LI extends string, const RI extends string, const SI extends string>(
  left: VersusPart<LC, LI> & {id: LI}, right: VersusPart<RC, RI> & {id: RI}, opts: VersusSharedOpts<SC, SI>,
): VersusResult<LC, RC, LI, RI, SC, SI>;
export function versus(
  left: VersusPart, right: VersusPart, opts: VersusOpts | VersusSharedOpts = {},
): VersusBands {
  const leftGroup = asGroup(left);
  const rightGroup = asGroup(right);
  const sides = row([leftGroup, rightGroup], {cols: [6, 6]});
  if (!opts.shared) return [sides];
  if (!left.id || !right.id || !opts.shared.id) throw new Error('versus(): left, right and shared need an id when shared is used');
  const shared = asGroup(opts.shared);
  const style = {...(opts.connectRoute === undefined ? {} : {route: opts.connectRoute}), ...(opts.connectArrow === undefined ? {} : {arrow: opts.connectArrow})} as const;
  return [
    sides,
    spacer(opts.connectLabels ? 48 : 28), // room for the arrows (and their labels) between the frames
    shared,
    // plumb: each line ends straight below the middle of its side, not at a fixed 1/4 / 3/4 of the shared top (which sits a few px off it)
    {...connect(`${left.id}:bottom`, `${opts.shared.id}:top@0.25`, {...style, ...(opts.connectLabels?.left === undefined ? {} : {label: opts.connectLabels.left})}), plumb: true},
    {...connect(`${right.id}:bottom`, `${opts.shared.id}:top@0.75`, {...style, ...(opts.connectLabels?.right === undefined ? {} : {label: opts.connectLabels.right})}), plumb: true},
  ];
}
