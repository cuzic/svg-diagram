import { capped, checkAnchors, countEmoji, totalText, validateAgainst } from './spec-validation.js';
export { capped, validateAgainst } from './spec-validation.js';
// A diagram as JSON data ("svg-diagram/spec"): the input for callers that must not run a `.ts` source, such as a public server taking
// diagrams from a model. A source is code (lib/load-source.ts imports it); a spec is data, checked against a schema and turned into builder
// calls from a fixed list. Each part below keeps its schema, its example and its builder together, so they change in one commit.
//
// Nothing here touches the disk or a process: this file imports only dsl-pure (and modules as pure as it, such as quadrant.ts). Left out on purpose: image() and math() (files, MathJax),
// `slide` / `fill` (a measured slide), `today: 'auto'` (the build's date) and `icon` (a process-wide manifest).
import { causeTree, chevron, cloud, cycle, diagram, flowchart, funnel, gantt, journeyMap, mindmap, pyramid, quadrant, raci, sequence, stateDiagram, swimlane, table, valueChain, venn, whyWhyTree } from './dsl-pure.js';
import { walkAnyBands as walkBands } from './full-definitions.js';
import { markSpecPart } from './source-ref.js';
import { locateIn, messageOf } from './spec-result.js';
export { cappedMessages, fieldsHolding, layoutIssue, lintMessages, locateMessage, locateVerdict } from './spec-result.js';
import { schemaForParts } from './spec-schema.js';
import { LEGEND_EN, MAX_EMOJI, MAX_TOTAL_TEXT, PART_EN, SpecError, withoutSchemaField } from './spec-kit.js';
export { SPEC_VERSION, CANVAS_LIMITS, MAX_TOTAL_TEXT, MAX_EMOJI, MAX_SWIMLANE_COLS, MAX_TREE_DEPTH, MAX_TREE_NODES, MAX_CAUSE_NODES, MAX_CAUSE_LINKS, MAX_ISSUES, SpecError, withoutSchemaField } from './spec-kit.js';
import { PARTS_R1 } from './spec-parts/r1.js';
import { PARTS_R2 } from './spec-parts/r2.js';
import { PARTS_R3 } from './spec-parts/r3.js';
import { PARTS_R4 } from './spec-parts/r4.js';
import { PARTS_R5 } from './spec-parts/r5.js';
import { PARTS_R6 } from './spec-parts/r6.js';
import { PARTS_R7 } from './spec-parts/r7.js';
import { BOARD } from './spec-parts/board.js';
import { defineFlowchartPart } from './spec-parts/flowchart.js';
import { definePyramidPart } from './spec-parts/pyramid.js';
import { defineFunnelPart } from './spec-parts/funnel.js';
import { defineCauseTreePart } from './spec-parts/cause-tree.js';
import { defineCloudPart } from './spec-parts/cloud.js';
import { defineValueChainPart } from './spec-parts/value-chain.js';
import { defineMindmapPart } from './spec-parts/mindmap.js';
import { defineQuadrantPart } from './spec-parts/quadrant.js';
import { defineChevronPart } from './spec-parts/chevron.js';
import { defineCyclePart } from './spec-parts/cycle.js';
import { defineStateDiagramPart } from './spec-parts/state-diagram.js';
import { defineGanttPart } from './spec-parts/gantt.js';
import { defineVennPart } from './spec-parts/venn.js';
import { defineTablePart } from './spec-parts/table.js';
import { defineJourneyMapPart } from './spec-parts/journey-map.js';
import { defineRaciPart } from './spec-parts/raci.js';
import { defineSwimlanePart } from './spec-parts/swimlane.js';
import { defineSequencePart } from './spec-parts/sequence.js';
import { defineWhyWhyTreePart } from './spec-parts/why-why-tree.js';
const PARTS = [
    defineFlowchartPart(flowchart),
    defineCauseTreePart(causeTree),
    defineCloudPart(cloud),
    defineValueChainPart(valueChain),
    defineMindmapPart(mindmap),
    defineQuadrantPart(quadrant),
    defineChevronPart(chevron),
    defineCyclePart(cycle),
    definePyramidPart(pyramid),
    defineStateDiagramPart(stateDiagram),
    defineGanttPart(gantt),
    defineVennPart(venn),
    defineFunnelPart(funnel),
    defineTablePart(table),
    defineJourneyMapPart(journeyMap),
    defineRaciPart(raci),
    defineWhyWhyTreePart(whyWhyTree),
    defineSwimlanePart(swimlane),
    defineSequencePart(sequence),
    ...PARTS_R1, ...PARTS_R2, ...PARTS_R3, ...PARTS_R4, ...PARTS_R5, ...PARTS_R6, ...PARTS_R7,
    BOARD,
];
const partOf = (type) => PARTS.find(p => p.type === type);
export const specSchema = schemaForParts(PARTS);
/** The parts a spec can hold, for a caller that writes specs: what each is for, its schema and a small valid example. */
export function partCatalog() {
    return PARTS.map(({ type, description, schema, example }) => ({ type, description, schema, example }));
}
/** Checks `input` all the way, builders included: a builder has rules of its own, and only it knows the columns a swimlane ends up with. */
function assemble(written) {
    const input = withoutSchemaField(written); // a spec file names its schema for the editor (ADR 0071)
    const issues = [];
    issues.push(...validateAgainst(specSchema, input));
    if (issues.length)
        return { diagram: null, issues: capped(issues) }; // everything below assumes the shapes are right
    // `width` narrows a document figure (ADR 0059); a canvas has its own width (ADR 0057), and the two would disagree on how wide it is
    if (input['width'] !== undefined && input['canvas'] !== undefined)
        return { diagram: null, issues: [{ path: 'width', message: 'does not go with canvas: give the canvas its width (canvas.width) and leave width out' }] };
    const chars = totalText(input);
    if (chars > MAX_TOTAL_TEXT)
        return { diagram: null, issues: [{ path: '', message: `holds ${chars} characters of text; the limit is ${MAX_TOTAL_TEXT}` }] };
    const emoji = countEmoji(input);
    if (emoji > MAX_EMOJI)
        return { diagram: null, issues: [{ path: '', message: `holds ${emoji} emoji; the limit is ${MAX_EMOJI}` }] };
    const { parts, version: _version, lang, ...given } = input;
    const english = lang === 'en';
    // the description a reader of the screen hears is generated in Japanese: in English it is the title, unless one is given
    const opts = english ? { legendLabels: { ...Object.assign({}, ...PARTS.map(p => p.legendEn ?? {})), ...LEGEND_EN }, desc: given['title'], ...given } : given;
    const enOf = (type) => PART_EN[type] ?? partOf(type)?.en;
    const list = parts.map(p => english && enOf(p['type']) ? { ...enOf(p['type']), ...p } : p);
    list.forEach((part, i) => partOf(part['type']).check(part, `parts[${i}]`, issues));
    checkAnchors(list, issues, partOf);
    if (issues.length)
        return { diagram: null, issues: capped(issues) };
    let d;
    try {
        d = diagram({ theme: 'blue', ...opts });
    }
    catch (e) {
        return { diagram: null, issues: [{ path: '', message: messageOf(e) }] };
    }
    list.forEach((part, i) => {
        const at = `parts[${i}]`;
        try {
            const built = partOf(part['type']).build(part, at);
            markSpecPart(walkBands([built].flat()), at);
            d.add(built);
        }
        catch (e) {
            if (e instanceof SpecError)
                issues.push(...e.issues);
            else
                issues.push({ path: locateIn(part, at, messageOf(e)) ?? at, message: messageOf(e) });
        }
    });
    return issues.length ? { diagram: null, issues: capped(issues) } : { diagram: d, issues };
}
/** Every problem with `input`, each with its place; empty when specToDiagram() can take it. */
export function validateSpec(input) {
    return assemble(input).issues;
}
/** The Diagram a valid spec describes (not drawn yet). Throws SpecError, with places, for anything wrong. */
export function specToDiagram(input) {
    const { diagram: d, issues } = assemble(input);
    if (!d)
        throw new SpecError(issues);
    return d;
}
