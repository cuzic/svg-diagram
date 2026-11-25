import { checkConnectionGeometry } from '../verify-connect-geometry.js';
import { prepareConnectorGaps } from '../layout-connect-gaps.js';
import { connectorInventory } from '../inventory-lines.js';
import { findingAcceptanceHint } from '../finding-rules.js';
import { connectorFindings, connectorRules } from '../verify-connect-crossings.js';
import { labelCoverFindings } from '../verify-connect-label.js';
import { graphFindings } from '../verify-connection-graph.js';
import { band, defOf, walkDefinedBands } from '../band-def.js';
import { connect as buildConnect } from '../dsl/connect.js';
import { bracket as buildBracket } from '../dsl/bracket.js';
import { branch as buildBranch } from '../dsl/branch.js';
import { callout as buildCallout } from '../dsl/callout.js';
import { connectSpotlight, connectorSvgDefs, renderConnect } from '../emit-connect.js';
import { layoutConnect, resolveConnect } from '../layout-connect.js';
import { loopBackConnectors } from '../loop-back-connectors.js';
import { rowSlotStages } from '../reveal-row.js';
import { resolveRevealId, warnConnectorReveal } from '../reveal-warnings.js';
import { CONNECT_LABEL_SIZE } from '../tokens.js';
/** A link follows its endpoints unless it sets its own end stage. */
function revealConnector(connector, ids) {
    const from = ids.get(connector.fromId), to = ids.get(connector.toId);
    const reveal = Math.max(connector.reveal ?? 0, from?.start ?? 0, to?.start ?? 0);
    const end = connector.until ?? Math.min(from?.end ?? Infinity, to?.end ?? Infinity);
    if (end <= reveal)
        throw new Error(`renderBands: connector "${connector.fromId}" → "${connector.toId}" is never visible`);
    return { ...connector, ...(reveal ? { reveal } : {}), ...(Number.isFinite(end) ? { until: end } : {}) };
}
function endpointStage(ids, id) {
    const direct = ids.get(id);
    const slot = id.lastIndexOf('#');
    if (direct || slot < 0)
        return direct;
    const row = ids.get(id.slice(0, slot))?.band;
    if (row?.type !== 'row' && row?.type !== 'grouprow')
        return;
    return rowSlotStages(row).get(id);
}
function revealElements(data, start) {
    const { from, to, reveal, until } = data;
    const result = { last: start, warnings: [] };
    if (reveal === undefined && until === undefined)
        return result;
    const authored = { from, to, reveal, until };
    result.checkEndpoints = (ids, scopes, warnings) => {
        const known = (id) => endpointStage(ids, id) !== undefined;
        const stageOf = (ref) => endpointStage(ids, resolveRevealId(scopes, ref, known));
        const a = stageOf(from), b = stageOf(to);
        warnConnectorReveal(warnings, authored, { start: Math.max(a?.start ?? 0, b?.start ?? 0), end: Math.min(a?.end ?? Infinity, b?.end ?? Infinity) });
    };
    return result;
}
const selectedGraphFindings = diagram => graphFindings(diagram, walkDefinedBands, data => defOf(data)?.ids?.(data) ?? []);
export const connectDefinition = {
    type: 'connect',
    spotlight: connectSpotlight,
    internal: true,
    layout: layoutConnect,
    connectorDefs: connectorSvgDefs,
    checkConnectionGeometry,
    connectorGaps: prepareConnectorGaps,
    resolveConnect,
    revealConnector,
    revealElements,
    connectorInventory,
    rules: connectorRules,
    verify: {
        legendNotation: data => data,
        diagramFindings: [labelCoverFindings, connectorFindings, selectedGraphFindings],
        acceptHint: rule => Object.hasOwn(connectorRules, rule) ? findingAcceptanceHint(rule) : undefined,
    },
    loopBackConnectors,
    measure(data, { atoms, roles }) {
        if (data.label)
            atoms(data.label, roles.connectLabel ?? CONNECT_LABEL_SIZE, 400);
    },
    emit: (laid, env) => renderConnect(laid, env.theme, env.tones, env.roles),
};
export function connect(from, to, opts) {
    const data = buildConnect(from, to, opts);
    return band(connectDefinition, data);
}
export function bracket(from, to, opts) {
    const data = buildBracket(from, to, opts);
    return band(connectDefinition, data);
}
export function callout(target, opts) {
    const data = buildCallout(target, opts);
    return band(connectDefinition, data);
}
export function branch(from, targets, opts) {
    return buildBranch(from, targets, opts).map(data => band(connectDefinition, data));
}
