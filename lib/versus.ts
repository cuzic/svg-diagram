import {connect, group, row, spacer} from './dsl.ts';
import type {Band, BandInput, BoxTone, ConnectBand, GroupBand, GroupRowBand, SpacerBand} from './types.ts';
import type {Declares, IdsOf, Refers, RefsOf} from './strict.ts';

export interface VersusPart<C extends BandInput = BandInput, Id extends string = string> {
  children: C;
  title?: string;
  tone?: BoxTone;
  id?: Id;
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
}

type VersusBands = (GroupRowBand | GroupBand | ConnectBand | SpacerBand)[];
type VersusResult<LC, RC, LI extends string, RI extends string, SC = never, SI extends string = never> =
  ((GroupRowBand | GroupBand | ConnectBand | SpacerBand)
    & Declares<IdsOf<LC> | IdsOf<RC> | IdsOf<SC> | LI | RI | SI>
    & Refers<RefsOf<LC> | RefsOf<RC> | RefsOf<SC>>)[];

function asGroup<C extends BandInput, Id extends string>(part: VersusPart<C, Id>): GroupBand & Declares<IdsOf<C> | Id> & Refers<RefsOf<C>> {
  return group(part.children as Band | Band[], {title: part.title, tone: part.tone, id: part.id});
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
  return [
    sides,
    spacer(opts.connectLabels ? 48 : 28), // room for the arrows (and their labels) between the frames
    shared,
    connect(`${left.id}:bottom`, `${opts.shared.id}:top@0.25`, opts.connectLabels?.left === undefined ? {} : {label: opts.connectLabels.left}),
    connect(`${right.id}:bottom`, `${opts.shared.id}:top@0.75`, opts.connectLabels?.right === undefined ? {} : {label: opts.connectLabels.right}),
  ];
}
