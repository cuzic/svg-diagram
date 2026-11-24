import {band, defOf, DEF} from '../../band-def.ts';
import {connectDefinition} from '../../bands/connect.ts';
import {groupDefinition} from '../../bands/group.ts';
import {groupRowDefinition} from '../../bands/group-row.ts';
import {rowDefinition} from '../../bands/row.ts';
import {spacerDefinition} from '../../bands/spacer.ts';
import type {GroupBand} from '../../types/containers.ts';
import type {Band} from '../../types/index.ts';
import {versus as build} from '../versus.ts';
import type {VersusOpts, VersusPart, VersusResult, VersusSharedOpts} from '../versus.ts';

export type {VersusConnectLabels, VersusOpts, VersusPart, VersusSharedOpts} from '../versus.ts';

type Selected = Band & {readonly [DEF]: object};
type Input = Selected | Selected[];

function attachGroup(data: GroupBand) {
  return band(groupDefinition, {...data, children: data.children.map(attach)});
}

function attach(data: Band): Selected {
  if (defOf(data)) return data as Selected;
  switch (data.type) {
    case 'group': return attachGroup(data);
    case 'grouprow': return band(groupRowDefinition, {...data, children: data.children.map(child => child.type === 'group' && !defOf(child) ? attachGroup(child) : child)});
    case 'row': return band(rowDefinition, data);
    case 'spacer': return band(spacerDefinition, data);
    case 'connect': return band(connectDefinition, data);
    default: throw new Error(`versus(): import "${data.type}" from its svg-diagram/bands entry`);
  }
}

export function versus<LC extends Input, RC extends Input, const LI extends string = never, const RI extends string = never>(
  left: VersusPart<LC, LI>, right: VersusPart<RC, RI>, opts?: VersusOpts,
): (VersusResult<LC, RC, LI, RI>[number] & Selected)[];
export function versus<LC extends Input, RC extends Input, SC extends Input, const LI extends string, const RI extends string, const SI extends string>(
  left: VersusPart<LC, LI> & {id: LI}, right: VersusPart<RC, RI> & {id: RI}, opts: VersusSharedOpts<SC, SI>,
): (VersusResult<LC, RC, LI, RI, SC, SI>[number] & Selected)[];
export function versus(left: VersusPart<Input>, right: VersusPart<Input>, opts: VersusOpts | VersusSharedOpts<Input> = {}): Selected[] {
  const data = opts.shared ? build({...left, id: left.id ?? ''}, {...right, id: right.id ?? ''}, opts) : build(left, right);
  return data.map(attach);
}
