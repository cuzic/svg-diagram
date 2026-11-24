import {checkConnectionGeometry} from '../verify-connect-geometry.ts';
import {prepareConnectorGaps} from '../layout-connect-gaps.ts';
import {connectorInventory} from '../inventory-lines.ts';
import {findingAcceptanceHint} from '../finding-rules.ts';
import {connectorFindings, connectorRules} from '../verify-connect-crossings.ts';
import {labelCoverFindings} from '../verify-connect-label.ts';
import {graphFindings} from '../verify-connection-graph.ts';
import {band, defOf, walkDefinedBands} from '../band-def.ts';
import type {BandDef, DiagramFindings, WithBandDef} from '../band-def.ts';
import {connect as buildConnect} from '../dsl/connect.ts';
import {bracket as buildBracket} from '../dsl/bracket.ts';
import {branch as buildBranch} from '../dsl/branch.ts';
import {callout as buildCallout} from '../dsl/callout.ts';
import type {BracketOpts, CalloutOpts} from '../dsl/connect.ts';
import {connectorSvgDefs, renderConnect} from '../emit-connect.ts';
import {layoutConnect, resolveConnect} from '../layout-connect.ts';
import type {BranchInput, ConnectInput, Ok} from '../strict.ts';
import {loopBackConnectors} from '../loop-back-connectors.ts';
import {CONNECT_LABEL_SIZE} from '../tokens.ts';
import type {ConnectBand, LaidOutConnect} from '../types/containers.ts';

type EndpointStage = {start: number; end?: number};

/** A link follows its endpoints unless it sets its own end stage. */
function revealConnector(connector: LaidOutConnect, ids: ReadonlyMap<string, EndpointStage>): LaidOutConnect {
  const from = ids.get(connector.fromId), to = ids.get(connector.toId);
  const reveal = Math.max(connector.reveal ?? 0, from?.start ?? 0, to?.start ?? 0);
  const end = connector.until ?? Math.min(from?.end ?? Infinity, to?.end ?? Infinity);
  if (end <= reveal) throw new Error(`renderBands: connector "${connector.fromId}" → "${connector.toId}" is never visible`);
  return {...connector, ...(reveal ? {reveal} : {}), ...(Number.isFinite(end) ? {until: end} : {})};
}

const selectedGraphFindings: DiagramFindings = diagram =>
  graphFindings(diagram, walkDefinedBands, data => defOf(data)?.ids?.(data) ?? []);

export const connectDefinition: BandDef<ConnectBand, LaidOutConnect> = {
  type: 'connect',
  internal: true,
  layout: layoutConnect,
  connectorDefs: connectorSvgDefs,
  checkConnectionGeometry,
  connectorGaps: prepareConnectorGaps,
  resolveConnect,
  revealConnector,
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

export function bracket<const F extends string, const T extends string>(
  from: Ok<F>, to: Ok<T>, opts?: BracketOpts,
): WithBandDef<ReturnType<typeof buildBracket<F, T>>, LaidOutConnect> {
  const data = buildBracket<F, T>(from, to, opts);
  return band<typeof data, LaidOutConnect>(connectDefinition, data);
}

export function callout<const T extends string>(
  target: Ok<T>, opts: CalloutOpts,
): WithBandDef<ReturnType<typeof buildCallout<T>>, LaidOutConnect> {
  const data = buildCallout<T>(target, opts);
  return band<typeof data, LaidOutConnect>(connectDefinition, data);
}

export function branch<const F extends string, const T extends string>(
  from: Ok<F>, targets: (BranchInput & {to: Ok<T>})[], opts?: BranchInput,
): WithBandDef<ReturnType<typeof buildBranch<F, T>>[number], LaidOutConnect>[] {
  return buildBranch<F, T>(from, targets, opts).map(data => band<typeof data, LaidOutConnect>(connectDefinition, data));
}
