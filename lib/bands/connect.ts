import {band} from '../band-def.ts';
import type {BandDef, WithBandDef} from '../band-def.ts';
import {connect as buildConnect} from '../dsl/connect.ts';
import {renderConnect} from '../emit-boxes.ts';
import {layoutConnect, resolveConnect} from '../layout-connect.ts';
import type {ConnectInput, Ok} from '../strict.ts';
import {expandLoopBacks} from '../loop-back.ts';
import {CONNECT_LABEL_SIZE} from '../tokens.ts';
import type {ConnectBand, LaidOutConnect} from '../types/containers.ts';

export const connectDefinition: BandDef<ConnectBand, LaidOutConnect> = {
  type: 'connect',
  internal: true,
  layout: layoutConnect,
  resolveConnect,
  expandLoopBacks,
  measure(data, {atoms, roles}) {
    if (data.label) atoms(data.label, roles.connectLabel ?? CONNECT_LABEL_SIZE, 400);
  },
  emit: (laid, env) => renderConnect(laid, env.theme, env.tones, env.roles),
};

export function connect<const F extends string, const T extends string>(
  from: Ok<F>, to: Ok<T>, opts?: ConnectInput,
): WithBandDef<ReturnType<typeof buildConnect<F, T>>, LaidOutConnect> {
  const data = buildConnect<F, T>(from, to, opts);
  return band<typeof data, LaidOutConnect>(connectDefinition, data);
}
