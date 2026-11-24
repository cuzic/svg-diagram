import {connectorInventory} from '../inventory-lines.ts';
import {findingAcceptanceHint} from '../finding-rules.ts';
import {connectorFindings, connectorRules} from '../verify-connect-crossings.ts';
import {labelCoverFindings} from '../verify-connect-label.ts';
import {graphFindings} from '../verify-connection-graph.ts';
import {band, defOf, walkDefinedBands} from '../band-def.ts';
import type {BandDef, DiagramFindings, WithBandDef} from '../band-def.ts';
import {connect as buildConnect} from '../dsl/connect.ts';
import {renderConnect} from '../emit-boxes.ts';
import {layoutConnect, resolveConnect} from '../layout-connect.ts';
import type {ConnectInput, Ok} from '../strict.ts';
import {loopBackConnectors} from '../loop-back.ts';
import {CONNECT_LABEL_SIZE} from '../tokens.ts';
import type {ConnectBand, LaidOutConnect} from '../types/containers.ts';

const selectedGraphFindings: DiagramFindings = diagram =>
  graphFindings(diagram, walkDefinedBands, data => defOf(data)?.ids?.(data) ?? []);

export const connectDefinition: BandDef<ConnectBand, LaidOutConnect> = {
  type: 'connect',
  internal: true,
  layout: layoutConnect,
  resolveConnect,
  connectorInventory,
  rules: connectorRules,
  verify: {
    diagramFindings: [labelCoverFindings, connectorFindings, selectedGraphFindings],
    acceptHint: rule => Object.hasOwn(connectorRules, rule) ? findingAcceptanceHint(rule) : undefined,
  },
  loopBackConnectors,
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
