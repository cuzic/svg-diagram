import {capped, checkAnchors, countEmoji, join, totalText, validateAgainst} from './spec-validation.ts';
export {capped, validateAgainst} from './spec-validation.ts';
// A diagram as JSON data ("svg-diagram/spec"): the input for callers that must not run a `.ts` source, such as a public server taking
// diagrams from a model. A source is code (lib/load-source.ts imports it); a spec is data, checked against a schema and turned into builder
// calls from a fixed list. Each part below keeps its schema, its example and its builder together, so they change in one commit.
//
// Nothing here touches the disk or a process: this file imports only dsl-pure (and modules as pure as it, such as quadrant.ts). Left out on purpose: image() and math() (files, MathJax),
// `slide` / `fill` (a measured slide), `today: 'auto'` (the build's date) and `icon` (a process-wide manifest).
import {causeTree, chevron, cloud, cycle, diagram, flowchart, funnel, gantt, journeyMap, mindmap, pyramid, quadrant, raci, sequence, stateDiagram, swimlane, table, valueChain, venn, whyWhyTree} from './dsl-pure.ts';
import {walkBands} from './rules.ts';
import {SOURCE, SourceRef, sourceOf} from './source-ref.ts';
import type {RenderChecks} from './svg-lint.ts';
import {SLIDE_CANVAS} from './tokens.ts';
import type {BandInput, Diagram, Issue, Verdict} from './types/index.ts';

import {CANVAS_LIMITS, SPEC_WIDTH, LEGEND_EN, MAX_CAUSE_NODES, MAX_EMOJI, MAX_ISSUES, MAX_TOTAL_TEXT, PART_EN, SPEC_VERSION, SpecError, items, list, object, oneOf, text, whyNode, whySize, withoutSchemaField} from './spec-kit.ts';
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
  {
    type: 'whyWhyTree',
    description: 'A why-why analysis (5 whys): the problem at the top, each answer to "why?" below the one it explains, root causes in a double frame, and what is done about each. Each answer should be a fact, not a person.',
    schema: object({
      type: {const: 'whyWhyTree'},
      problem: text('The problem that happened.', 60),
      readingNote: {type: 'boolean', description: 'false: leave out the lines under the tree that say how to read it.'},
      whys: list(whyNode(4), 4, 1),
    }, ['type', 'problem', 'whys']),
    example: {type: 'whyWhyTree', problem: 'リリースが遅れた', whys: [{why: '修正に時間がかかった', because: [{why: '検証が最後に集中していた', trueCause: true, measure: '結合テストを毎週回す'}]}]},
    check(part, at, issues) {
      const n = 1 + items(part, 'whys').reduce((k, w) => k + whySize(w), 0);
      if (n > MAX_CAUSE_NODES) issues.push({path: `${at}.whys`, message: `make ${n} boxes with the problem and the measures; the limit is ${MAX_CAUSE_NODES}`});
    },
    build(part) {
      return whyWhyTree(part['problem'] as string, part['whys'] as never, part['readingNote'] === undefined ? {} : {readingNote: part['readingNote'] as boolean});
    },
  },
  defineSwimlanePart<ReturnType<typeof swimlane>>(swimlane),
  defineSequencePart<ReturnType<typeof sequence>>(sequence),
  ...PARTS_R1, ...PARTS_R2, ...PARTS_R3, ...PARTS_R4, ...PARTS_R5, ...PARTS_R6, ...PARTS_R7,
  BOARD,
];

const partOf = (type: unknown): PartDef | undefined => PARTS.find(p => p.type === type);

/** The width a figure without a canvas is drawn at: a document's text column (diagram() in lib/dsl/diagram.ts). */
const DOC_WIDTH = 940;

/** The JSON Schema of a whole spec. */
export const specSchema: JsonSchema = object({
  version: {const: SPEC_VERSION, description: 'Always 1.'},
  lang: {...oneOf('ja', 'en'), description: "The language of the words the figure writes by itself (legends, headings such as 'Today'): ja (default) or en. Write your own text in the same language."},
  title: text('The accessible name of the figure. Drawn above it only with showTitle.', 120),
  showTitle: {type: 'boolean', description: 'true: draw the title above the figure.'},
  desc: text('A one-sentence description for screen readers.', 400),
  sourceLine: text('Where the content comes from, printed under the figure.', 120),
  theme: {...oneOf('blue', 'teal', 'amber'), description: 'Default blue.'},
  appearance: oneOf('light', 'dark'),
  density: oneOf('normal', 'compact'),
  width: {type: 'integer', minimum: SPEC_WIDTH.min, maximum: SPEC_WIDTH.max, description: `The width the figure is laid out at, in px (${SPEC_WIDTH.min} to ${SPEC_WIDTH.max}, default ${SPEC_WIDTH.max}): narrower makes boxes and tables wrap their text instead of the figure being shrunk later (a column of a slide). Text sizes do not change.`},
  legend: {enum: ['auto', false], description: "'auto' lists the notation used; false shows no legend."},
  canvas: object({
    width: {type: 'integer', minimum: CANVAS_LIMITS.width[0], maximum: CANVAS_LIMITS.width[1], description: `The width of the canvas in px (default ${SLIDE_CANVAS.width}).`},
    height: {type: 'integer', minimum: CANVAS_LIMITS.height[0], maximum: CANVAS_LIMITS.height[1], description: `The height of the canvas in px (default ${SLIDE_CANVAS.height}). With fit 'content', the most it may be.`},
    minText: {type: 'number', minimum: CANVAS_LIMITS.minText[0], maximum: CANVAS_LIMITS.minText[1], description: `The smallest text in px (default ${SLIDE_CANVAS.minText}). Every text, box and gap grows by minText / 14.`},
    fit: {...oneOf('content'), description: "'content': the canvas is as tall as what it holds, up to height. Left out: always height tall."},
  }, [], `A figure for a slide or a screen, shown at its own size (1920x1080 for a full HD slide), instead of a figure for a document (${DOC_WIDTH}px wide, shown in a text column). Text and boxes grow with minText, so a large canvas holds more only when minText stays small.`),
  parts: list({oneOf: PARTS.map(p => p.schema)}, 4, 1),
}, ['version', 'title', 'parts']);

/** The parts a spec can hold, for a caller that writes specs: what each is for, its schema and a small valid example. */
export function partCatalog(): {type: string; description: string; schema: JsonSchema; example: Json}[] {
  return PARTS.map(({type, description, schema, example}) => ({type, description, schema, example}));
}

const messageOf = (e: unknown): string => e instanceof Error ? e.message : String(e);

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
      const refs = new Map<SourceRef['stackHolder'], SourceRef>();
      for (const band of walkBands([built].flat())) {
        const stack = sourceOf(band)?.stackHolder;
        let ref = refs.get(stack);
        if (!ref) {
          ref = new SourceRef(stack, at);
          refs.set(stack, ref);
        }
        (band as typeof band & {[SOURCE]?: SourceRef})[SOURCE] = ref;
      }
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

const TEXT_FIELDS: ReadonlySet<string> = new Set(['id', 'label', 'sub', 'title', 'desc', 'sourceLine', 'body', 'note', 'tag', 'divider']);
function leaves(v: unknown, at: string, out: [string, string][]): void {
  if (Array.isArray(v)) v.forEach((x, i) => leaves(x, `${at}[${i}]`, out));
  else if (typeof v === 'object' && v !== null) for (const [k, x] of Object.entries(v)) {
    if (typeof x === 'string') { if (TEXT_FIELDS.has(k)) out.push([x, join(at, k)]); }
    else leaves(x, join(at, k), out);
  }
}
const QUOTED = /"([^"]+)"|「([^」]+)」|'([^']+)'/g;
/** What a message quotes, without the ellipsis of a shortened text. */
const quotedIn = (message: string): string[] => [...message.matchAll(QUOTED)].map(m => (m[1] ?? m[2] ?? m[3] ?? '').replace(/(…|\.\.\.)$/, ''));
/** The closest place the texts share: one text, or the part they are all in. */
function commonPlace(hits: readonly [string, string][]): string | null {
  if (hits.length === 1) return (hits[0] as [string, string])[1];
  const partOfPath = (p: string) => /^parts\[\d+\]/.exec(p)?.[0] ?? null;
  const first = partOfPath((hits[0] as [string, string])[1]);
  return first && hits.every(h => partOfPath(h[1]) === first) ? first : null;
}
/**
 * The place of the text that `message` quotes, or null. Only quoted text counts: a word of the message itself ("Yes / No", "diagram.svg")
 * is not a mention. An exact match is taken first, then the start of a text (the checks shorten long ones), then a piece of it (a wrapped line).
 */
function locateIn(v: unknown, at: string, message: string): string | null {
  const found: [string, string][] = [];
  leaves(v, at, found);
  for (const q of quotedIn(message)) {
    const tests: ((s: string) => boolean)[] = [s => s === q];
    if (q.length >= 2) tests.push(s => s.startsWith(q), s => s.includes(q));
    for (const test of tests) {
      const hits = found.filter(f => test(f[0]));
      if (hits.length === 0) continue;
      const place = commonPlace(hits);
      if (place) return place;
      break; // the same text in several parts: this quote says nothing, another may
    }
  }
  return null;
}

/** A message from drawing or checking, with the place in the spec it is about. `path` is null when the message names nothing in the spec. */
export interface LocatedMessage {
  path: string | null;
  message: string;
  rule?: string;
  severity?: 'problem' | 'warn' | 'info';
  fix?: string;
}

/** The field a message names, searching within its source part when marked. */
export function locateMessage(spec: unknown, message: string, loc?: SourceRef): string | null {
  return locateMessageWithSources(spec, message, loc);
}

function locateMessageWithSources(spec: unknown, message: string, loc?: SourceRef, related: readonly SourceRef[] = []): string | null {
  const parts = (spec as Json)['parts'] as unknown[];
  for (const ref of [loc, ...related]) {
    const at = ref?.specPath;
    if (at === undefined) continue;
    const index = Number(/^parts\[(\d+)\]$/.exec(at)?.[1]);
    const part = parts[index];
    if (part === undefined) continue;
    const path = linkOf([part], message, index) ?? locateIn(part, at, message);
    // Several matching fields can resolve to the part itself. Keep looking for a field.
    if (path !== null && path !== at) return path;
  }
  if (loc?.specPath !== undefined) return loc.specPath;
  const link = linkOf(parts, message);
  if (link) return link;
  const quoted = locateIn(spec, '', message);
  if (quoted) return quoted;
  if (parts.length === 1) return 'parts[0]';
  // a builder or layout message starts with the part's name: `swimlane(): 40 columns ...`
  const named = /^(\w+)\(/.exec(message)?.[1];
  const same = parts.flatMap((p, i) => (p as Json)['type'] === named ? [i] : []);
  return same.length === 1 ? `parts[${same[0]}]` : null;
}

/** A message about `connect(a:side -> b:side)`: the board link (ADR 0069 D4) that made it, when exactly one link joins a to b. */
const CONNECT_OF = /^connect\(([^\s:@]+)(?::\w+)?(?:@[\d.]+)? -> ([^\s:@)]+)/;
function linkOf(parts: readonly unknown[], message: string, firstIndex = 0): string | null {
  const m = CONNECT_OF.exec(message);
  if (!m) return null;
  const hits = parts.flatMap((p, i) => (p as Json)['type'] !== 'board' ? [] : items(p as Json, 'links').flatMap((l, j) => l['from'] === m[1] && l['to'] === m[2] ? [`parts[${firstIndex + i}].links[${j}]`] : []));
  return hits.length === 1 ? hits[0] as string : null;
}

/** The DSL's advice names options a spec does not have; this is the same advice in the fields a spec does have. */
const LABEL_HAS_NO_ROOM = / \(widen the gap between the boxes, shorten the label, or label a longer leg with route: 'elbow'\)$/;
const LABEL_ADVICE = 'Shorten or drop this label, raise colGap, or leave an empty column between the two steps.';
const COLUMNS_TOO_NARROW = /^(swimlane\(\): \d+ columns leave only -?\d+px each)\b.*$/s;
const COLUMNS_ADVICE = 'Lower colGap or use fewer columns.';
/** A figure too narrow for its band (flow-shapes.ts): a spec has no width, so only the rest of the advice (fewer sectors or steps, the circle). */
const WIDEN_DIAGRAM = /widen the diagram \(diagram\(\{width: \d+\}\) or more\), /;
/** An area of a board too narrow: a spec gives no diagram({width}) to widen it, but areas can take more rows. */
const AREA_TOO_NARROW = /^(areas: area "[^"]*" is only \d+px wide \(at least \d+px\)): .*$/s;
const AREA_ADVICE = 'Put the nodes in more rows (areas), give this column a larger share (cols), or use a smaller gap.';
function inSpecTerms(message: string): {message: string; fix?: string} {
  if (AREA_TOO_NARROW.test(message)) return {message: message.replace(AREA_TOO_NARROW, '$1'), fix: AREA_ADVICE};
  if (WIDEN_DIAGRAM.test(message)) return {message: message.replace(WIDEN_DIAGRAM, '')};
  if (LABEL_HAS_NO_ROOM.test(message)) return {message: message.replace(LABEL_HAS_NO_ROOM, ''), fix: LABEL_ADVICE};
  if (COLUMNS_TOO_NARROW.test(message)) return {message: message.replace(COLUMNS_TOO_NARROW, '$1'), fix: COLUMNS_ADVICE};
  return {message};
}

/** Why a figure could not be laid out, at its place and in the fields a spec has. */
export function layoutIssue(spec: unknown, error: unknown): SpecIssue {
  const raw = messageOf(error), loc = error instanceof Error ? sourceOf(error) : undefined;
  const {message, fix} = inSpecTerms(raw);
  return {path: locateMessage(spec, raw, loc) ?? '', message: fix ? `${message}. ${fix}` : message};
}

/** Every text field that holds `char`. */
export function fieldsHolding(spec: unknown, char: string): string[] {
  const found: [string, string][] = [];
  leaves(spec, '', found);
  return found.filter(([text]) => text.includes(char)).map(([, at]) => at);
}

/** The same limit on the messages of a drawn figure as on the issues of a spec. */
export function cappedMessages(list: LocatedMessage[]): LocatedMessage[] {
  return list.length <= MAX_ISSUES ? list : [...list.slice(0, MAX_ISSUES), {path: null, message: `and ${list.length - MAX_ISSUES} more of the same kind: fix these first`}];
}

/** A renderDiagram() verdict in the spec's terms: what failed (`problems`) and what was noticed (`findings`), each with its place. */
export function locateVerdict(spec: unknown, verdict: Verdict): {problems: LocatedMessage[]; findings: LocatedMessage[]} {
  const issues: Issue[] = verdict.issues ?? verdict.problems.map(message => ({message}));
  return {
    problems: issues.map(({message, loc}) => ({path: locateMessage(spec, message, loc), ...inSpecTerms(message), severity: 'problem' as const})),
    findings: verdict.findings.map(f => ({path: locateMessageWithSources(spec, f.message, f.loc, f.related), message: f.message, rule: f.rule, severity: f.severity, ...(f.data?.fix ? {fix: f.data.fix} : {})})),
  };
}

/** What the checks found, as lines a model or a person can act on: `errors` fail `svg-diagram lint`, `advisories` are heuristics it only reports. */
export function lintMessages(c: RenderChecks): {errors: string[]; advisories: string[]} {
  return {
    errors: [
      ...c.contrast.map(x => `low contrast: "${x.txt}" (${x.fg} on ${x.bg})`),
      ...(c.overflow ? [`content runs past the canvas by ${c.overflow.dx}px horizontally and ${c.overflow.dy}px vertically`] : []),
      ...c.textOverlap.map(x => `text over text: "${x.a}" and "${x.b}"`),
    ],
    advisories: [
      ...c.containerOverflow.map(x => `text out of its box by ${x.over}px: "${x.txt}"`),
      ...c.covered.map(x => `"${x.txt}" is ${x.how === 'covers' ? 'covered' : 'crossed'} by ${x.by}`),
    ],
  };
}


export interface RenderSpecResult {
  /** false when the spec is invalid, or the figure failed verification or the checks on the drawing. */
  ok: boolean;
  /** Null when nothing could be drawn. When only the checks failed, this is the picture that was drawn. */
  svg: string | null;
  width: number;
  height: number;
  /** The spec could not be used or laid out, or the figure is too tall; nothing was returned to draw. */
  issues: SpecIssue[];
  /** What failed in the drawn figure. */
  problems: LocatedMessage[];
  /** Advice that does not fail the figure. */
  findings: LocatedMessage[];
}
