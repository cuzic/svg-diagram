import { layoutBoxLike } from '../layout-box-like.js';
import { ownRunSizes } from '../band-text-sizes.js';
import { whole } from '../inventory-core.js';
import { describeSwimlane } from '../diagram-description.js';
import { narrowTextFindings } from '../verify-shrink.js';
import { band } from '../band-def.js';
import { withAnchors } from '../dsl/shared.js';
import { swimlane as build } from '../dsl/swimlane.js';
import { renderSwimlane } from '../emit-swimlane.js';
import { layoutSwimlane } from '../layout-swimlane.js';
import { swimlaneFindings } from '../swimlane-rules.js';
import { checked } from '../reveal-visibility.js';
import { boxDefinition, boxDiagramFindings } from './box.js';
/** one-story: more than one swimlane in a diagram. */
const oneStoryFindings = (diagram) => {
    const count = diagram.bands.filter(b => b.type === 'swimlane').length;
    return count > 1 ? [{ rule: 'one-story', severity: 'warn', message: `スイムレーンが ${count} つある。1 図 1 話にして、図を分けることを検討する` }] : [];
};
const definition = {
    type: 'swimlane',
    textSizes: ownRunSizes,
    inventory: whole,
    describe: (data, stage) => ['structure', describeSwimlane(data, stage)],
    internal: true,
    layoutBoxLike,
    layout: layoutSwimlane,
    outputDefinitions: { box: boxDefinition },
    measure(data, env) {
        const { atoms, roles } = env;
        for (const lane of data.lanes)
            atoms(lane.label, roles.title, 700);
        for (const phase of data.phases ?? [])
            atoms(phase.label, roles.note, 700);
        for (const boundary of data.boundaries ?? [])
            if (boundary.label)
                atoms(boundary.label, roles.note, 700);
        for (const step of data.steps)
            boxDefinition.measure?.(step, env);
    },
    revealElements(data, start, end) {
        let last = start;
        for (const [index, step] of data.steps.entries()) {
            const label = `swimlane() step ${index + 1}`;
            const reveal = Math.max(start, checked(step.reveal, label) ?? 0);
            const until = Math.min(end ?? Infinity, checked(step.until, `${label} (until)`) ?? Infinity);
            if (until <= reveal)
                throw new Error(`${label}: until ${until} must be later than its reveal ${reveal}`);
            if (reveal)
                step.reveal = reveal;
            if (Number.isFinite(until))
                step.until = until;
            last = Math.max(last, step.until ?? reveal);
        }
        return { last, warnings: [], items: data.steps };
    },
    emit: (laid, env) => renderSwimlane(laid, env.theme, env.roles),
    verify: {
        diagramFindings: [...boxDiagramFindings, oneStoryFindings],
        findings: (data, { connects }) => swimlaneFindings(data, connects),
        layoutFindings: narrowTextFindings,
        rects: () => [],
    },
};
export function swimlane(lanes, steps, opts, connectors) {
    const bands = build(lanes, steps, opts).map(data => {
        if (data.type === 'swimlane')
            return band(definition, data);
        if (!connectors?.internal || !connectors.resolveConnect)
            throw new Error('bands/swimlane: flows を使う場合は bands/connect の connectDefinition を第4引数に渡してください');
        return band(connectors, data);
    });
    return withAnchors(bands, [opts?.id, ...steps.map(step => step.id)]);
}
/** @internal Definition used by the full renderer. */
export const swimlaneDefinition = definition;
