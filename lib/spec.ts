import {capped, checkAnchors, countEmoji, totalText, validateAgainst} from './spec-validation.ts';
export {capped, validateAgainst} from './spec-validation.ts';
// A diagram as JSON data ("svg-diagram/spec"): the input for callers that must not run a `.ts` source, such as a public server taking
// diagrams from a model. A source is code (lib/load-source.ts imports it); a spec is data, checked against a schema and turned into builder
// calls from a fixed list. Each part below keeps its schema, its example and its builder together, so they change in one commit.
//
// Nothing here touches the disk or a process: this file imports only dsl-pure (and modules as pure as it, such as quadrant.ts). Left out on purpose: image() and math() (files, MathJax),
// `slide` / `fill` (a measured slide), `today: 'auto'` (the build's date) and `icon` (a process-wide manifest).
import {causeTree, chevron, cloud, cycle, diagram, flowchart, funnel, gantt, journeyMap, mindmap, pyramid, quadrant, raci, sequence, stateDiagram, swimlane, table, valueChain, venn, whyWhyTree} from './dsl-pure.ts';
import {walkBands} from './rules.ts';
import {markSpecPart} from './source-ref.ts';
import {locateIn, messageOf} from './spec-result.ts';
export {cappedMessages, fieldsHolding, layoutIssue, lintMessages, locateMessage, locateVerdict} from './spec-result.ts';
export type {LocatedMessage, RenderSpecResult} from './spec-result.ts';
import {schemaForParts} from './spec-schema.ts';
import type {BandInput, Diagram} from './types/index.ts';

import {LEGEND_EN, MAX_EMOJI, MAX_TOTAL_TEXT, PART_EN, SpecError, withoutSchemaField} from './spec-kit.ts';
import type {Json, JsonSchema, PartDef, SpecIssue} from './spec-kit.ts';
export {SPEC_VERSION, CANVAS_LIMITS, MAX_TOTAL_TEXT, MAX_EMOJI, MAX_SWIMLANE_COLS, MAX_TREE_DEPTH, MAX_TREE_NODES, MAX_CAUSE_NODES, MAX_CAUSE_LINKS, MAX_ISSUES, SpecError, withoutSchemaField} from './spec-kit.ts';
export type {JsonSchema, SpecIssue} from './spec-kit.ts';
import {PARTS_R1} from './spec-parts/r1.ts';
import {PARTS_R2} from './spec-parts/r2.ts';
import {PARTS_R3} from './spec-parts/r3.ts';
import {PARTS_R4} from './spec-parts/r4.ts';
import {PARTS_R5} from './spec-parts/r5.ts';
import {PARTS_R6} from './spec-parts/r6.ts';
import {PARTS_R7} from './spec-parts/r7.ts';
import {BOARD} from './spec-parts/board.ts';

import {defineFlowchartPart} from './spec-parts/flowchart.ts';
import {definePyramidPart} from './spec-parts/pyramid.ts';
import {defineFunnelPart} from './spec-parts/funnel.ts';
import {defineCauseTreePart} from './spec-parts/cause-tree.ts';
import {defineCloudPart} from './spec-parts/cloud.ts';
import {defineValueChainPart} from './spec-parts/value-chain.ts';
import {defineMindmapPart} from './spec-parts/mindmap.ts';
import {defineQuadrantPart} from './spec-parts/quadrant.ts';
import {defineChevronPart} from './spec-parts/chevron.ts';
import {defineCyclePart} from './spec-parts/cycle.ts';
import {defineStateDiagramPart} from './spec-parts/state-diagram.ts';
import {defineGanttPart} from './spec-parts/gantt.ts';
import {defineVennPart} from './spec-parts/venn.ts';
import {defineTablePart} from './spec-parts/table.ts';
import {defineJourneyMapPart} from './spec-parts/journey-map.ts';
import {defineRaciPart} from './spec-parts/raci.ts';
import {defineSwimlanePart} from './spec-parts/swimlane.ts';
import {defineSequencePart} from './spec-parts/sequence.ts';

import {defineWhyWhyTreePart} from './spec-parts/why-why-tree.ts';

const PARTS: readonly PartDef[] = [
  defineFlowchartPart<ReturnType<typeof flowchart>>(flowchart),
  defineCauseTreePart<ReturnType<typeof causeTree>>(causeTree),
  defineCloudPart<ReturnType<typeof cloud>>(cloud),
  defineValueChainPart<ReturnType<typeof valueChain>>(valueChain),
  defineMindmapPart<ReturnType<typeof mindmap>>(mindmap),
  defineQuadrantPart<ReturnType<typeof quadrant>>(quadrant),
  defineChevronPart<ReturnType<typeof chevron>>(chevron),
  defineCyclePart<ReturnType<typeof cycle>>(cycle),
  definePyramidPart(pyramid),
  defineStateDiagramPart<ReturnType<typeof stateDiagram>>(stateDiagram),
  defineGanttPart<ReturnType<typeof gantt>>(gantt),
  defineVennPart<ReturnType<typeof venn>>(venn),
  defineFunnelPart(funnel),
  defineTablePart<ReturnType<typeof table>>(table),
  defineJourneyMapPart<ReturnType<typeof journeyMap>>(journeyMap),
  defineRaciPart<ReturnType<typeof raci>>(raci),
  defineWhyWhyTreePart<ReturnType<typeof whyWhyTree>>(whyWhyTree),
  defineSwimlanePart<ReturnType<typeof swimlane>>(swimlane),
  defineSequencePart<ReturnType<typeof sequence>>(sequence),
  ...PARTS_R1, ...PARTS_R2, ...PARTS_R3, ...PARTS_R4, ...PARTS_R5, ...PARTS_R6, ...PARTS_R7,
  BOARD,
];

const partOf = (type: unknown): PartDef | undefined => PARTS.find(p => p.type === type);

export const specSchema = schemaForParts(PARTS);

/** The parts a spec can hold, for a caller that writes specs: what each is for, its schema and a small valid example. */
export function partCatalog(): {type: string; description: string; schema: JsonSchema; example: Json}[] {
  return PARTS.map(({type, description, schema, example}) => ({type, description, schema, example}));
}

/** Checks `input` all the way, builders included: a builder has rules of its own, and only it knows the columns a swimlane ends up with. */
function assemble(written: unknown): {diagram: Diagram | null; issues: SpecIssue[]} {
  const input = withoutSchemaField(written); // a spec file names its schema for the editor (ADR 0071)
  const issues: SpecIssue[] = [];
  issues.push(...validateAgainst(specSchema, input));
  if (issues.length) return {diagram: null, issues: capped(issues)}; // everything below assumes the shapes are right
  // `width` narrows a document figure (ADR 0059); a canvas has its own width (ADR 0057), and the two would disagree on how wide it is
  if ((input as Json)['width'] !== undefined && (input as Json)['canvas'] !== undefined) return {diagram: null, issues: [{path: 'width', message: 'does not go with canvas: give the canvas its width (canvas.width) and leave width out'}]};
  const chars = totalText(input);
  if (chars > MAX_TOTAL_TEXT) return {diagram: null, issues: [{path: '', message: `holds ${chars} characters of text; the limit is ${MAX_TOTAL_TEXT}`}]};
  const emoji = countEmoji(input);
  if (emoji > MAX_EMOJI) return {diagram: null, issues: [{path: '', message: `holds ${emoji} emoji; the limit is ${MAX_EMOJI}`}]};
  const {parts, version: _version, lang, ...given} = input as Json;
  const english = lang === 'en';
  // the description a reader of the screen hears is generated in Japanese: in English it is the title, unless one is given
  const opts = english ? {legendLabels: {...Object.assign({}, ...PARTS.map(p => p.legendEn ?? {})), ...LEGEND_EN}, desc: given['title'], ...given} : given;
  const enOf = (type: unknown): Json | undefined => PART_EN[type as string] ?? partOf(type)?.en;
  const list = (parts as Json[]).map(p => english && enOf(p['type']) ? {...enOf(p['type']), ...p} : p);
  list.forEach((part, i) => (partOf(part['type']) as PartDef).check(part, `parts[${i}]`, issues));
  checkAnchors(list, issues, partOf);
  if (issues.length) return {diagram: null, issues: capped(issues)};
  let d: Diagram;
  try { d = diagram({theme: 'blue', ...opts} as never) as unknown as Diagram; }
  catch (e) { return {diagram: null, issues: [{path: '', message: messageOf(e)}]}; }
  list.forEach((part, i) => {
    const at = `parts[${i}]`;
    try {
      const built = (partOf(part['type']) as PartDef).build(part, at) as BandInput;
      markSpecPart(walkBands([built].flat()), at);
      d.add(built);
    }
    catch (e) {
      if (e instanceof SpecError) issues.push(...e.issues);
      else issues.push({path: locateIn(part, at, messageOf(e)) ?? at, message: messageOf(e)});
    }
  });
  return issues.length ? {diagram: null, issues: capped(issues)} : {diagram: d, issues};
}

/** Every problem with `input`, each with its place; empty when specToDiagram() can take it. */
export function validateSpec(input: unknown): SpecIssue[] {
  return assemble(input).issues;
}

/** The Diagram a valid spec describes (not drawn yet). Throws SpecError, with places, for anything wrong. */
export function specToDiagram(input: unknown): Diagram {
  const {diagram: d, issues} = assemble(input);
  if (!d) throw new SpecError(issues);
  return d;
}
