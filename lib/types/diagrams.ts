// Types: tree, states, cause / cloud (TOC), classes and bpmn.
import type {IconGlyph} from '../icon-store.ts';
import type {IconName} from '../icons.ts';
import type {Anchor, Dimmed, EmphasisTone, RcaInfo, Rect, RevealOpts, ScopeOpts, TextTone} from './core.ts';
import type {BoxTone} from './text-bands.ts';
import type {GanttText} from './timeline.ts';

export interface TreeItem {
  label: string;
  /** A second, muted line (a title, a headcount). */
  sub?: string;
  /** Makes the node an anchor: connect() can start or end there. */
  id?: string;
  tone?: BoxTone;
  children?: TreeItem[];
}
export interface TreeOpts extends RevealOpts, ScopeOpts {
  /** 'down' (default): levels run top to bottom. 'right': left to right, which fits more siblings in a narrow figure.
   *  'auto' (and leaving it out) lets the layout narrow the nodes and turn to the other direction when the figure is wider than the diagram
   *  (a warning when left out, a note for 'auto'). Writing a direction fixes it: a figure that does not fit is an error that lists what was tried. */
  dir?: 'down' | 'right' | 'auto';
  /** The widest a node grows before its text wraps (default 200px). */
  maxNodeW?: number;
  /** A spotlight target and a connect() endpoint (the whole figure). */
  id?: string;
}
export interface TreeBand extends TreeOpts {
  type: 'tree';
  root: TreeItem;
  /** mindmap(): the root in the middle, children split to both sides (the same band, laid out by layoutBalanced). */
  balanced?: boolean;
  /** mindmap(): the side of a root child, by its id (the rest are balanced by height). */
  sides?: Record<string, 'left' | 'right'>;
  /** mindmap(): how the branches are laid out (default 'radial'). */
  layout?: MindmapLayout;
  /** mindmap(): how a branch's line is drawn (tree-like layouts: radial / right / left / down / up). */
  edges?: 'elbow' | 'curve' | 'straight';
}
/**
 * radial: the root in the middle, branches to both sides | right / left: one side only (a logic chart) | down / up: a tree |
 * org: the root's children side by side, each with a list below | list: an outline, indented | brace: a brace map |
 * fishbone: cause and effect, the root is the head | timeline: children along an axis, alternately above and below.
 */
export type MindmapLayout = 'radial' | 'right' | 'left' | 'down' | 'up' | 'org' | 'list' | 'brace' | 'fishbone' | 'timeline';
export interface MindmapOpts extends RevealOpts, ScopeOpts {
  /** How the branches are laid out (default 'radial'): see MindmapLayout. */
  layout?: MindmapLayout;
  /** How a branch's line is drawn: 'elbow' (default), 'curve' or 'straight'. For radial / right / left / down / up. */
  edges?: 'elbow' | 'curve' | 'straight';
  /** Pin a child of the root (by its id) to a side; the others are balanced by height. */
  sides?: Record<string, 'left' | 'right'>;
  maxNodeW?: number;
  id?: string;
}
export interface StateItem {
  /** Required: the state is an anchor, and transitions name it. */
  id: string;
  label: string;
  /** A second, muted line (an entry action, a note). */
  sub?: string;
  /** Default 'plain'. 'solid' / 'solid-danger' fill the state (white text): the lead state of the figure / the failure. */
  tone?: EmphasisTone;
  /** An end state: drawn with a double outline. */
  final?: boolean;
  /** 'circle': a round node that holds a short text (an event of an arrow diagram). Default a rounded box. */
  shape?: 'box' | 'circle';
  /** An installed SVG icon (see `icon`), 24px, centred above the label. */
  icon?: IconName;
  /** Internal: the installed path of `icon`, resolved by stateDiagram(). */
  iconGlyph?: IconGlyph;
}
export interface Transition {
  from: string;
  to: string;
  /** The event / condition, on the arrow (a state may go to itself). */
  label?: string;
  line?: 'solid' | 'dashed' | 'dotted';
  /** The colour of the arrow and its head: danger (the critical path), accent, muted. Default the text colour. */
  tone?: 'danger' | 'accent' | 'muted';
  /** A thick arrow. */
  strong?: boolean;
}
export interface StatesOpts extends RevealOpts, ScopeOpts {
  /** 'right' (default): the flow runs left to right. 'down': top to bottom.
   *  'auto' (and leaving it out) lets the layout narrow the states and turn to the other direction when the figure is wider than the diagram
   *  (a warning when left out, a note for 'auto'). Writing a direction fixes it: a figure that does not fit is an error that lists what was tried. */
  dir?: 'right' | 'down' | 'auto';
  /** The state that starts: a filled dot with an arrow into it. */
  initial?: string;
  maxNodeW?: number;
  /** A transition back to an earlier layer that skips two layers or more: 'inline' (default, through the figure) or 'outer' (in a lane outside the figure). */
  returns?: 'inline' | 'outer';
  /** Lay the figure out with the plain coordinates only (default true: a straightened layout is used when it has strictly fewer crossings, then bends). `false` keeps the older picture. */
  straighten?: boolean;
  id?: string;
}
export interface StatesBand extends StatesOpts {
  type: 'states';
  states: StateItem[];
  transitions: Transition[];
}
/** What an entity is. It sets the default tone and, for the two that name the finding, a double outline. */
export type CauseRole = 'effect' | 'ude' | 'root' | 'de' | 'injection' | 'goal' | 'obstacle' | 'io' | 'action' | 'start' | 'step' | 'risk' | 'measure' | 'precondition' | 'tipping' | 'trim' | 'need';
export interface CauseNode {
  /** Required: links name it, and connect() can reach it. */
  id: string;
  label: string;
  /** A second, muted line (a measure, a note). */
  sub?: string;
  /** ude = undesirable effect (danger), root = root cause (accent, double outline), de = desirable effect, injection = the change put in,
   *  goal = the goal of a prerequisite tree (double outline), obstacle, io = intermediate objective, action = a step of a transition tree,
   *  precondition = a fact of the present nobody controls (grey, dashed box; AND it with an injection's result in a future reality tree).
   *  tipping = the tipping point of a negative branch (danger tone, double outline), trim = the injection that cuts a negative branch (dashed box; `kind: 'blocks'` to what it cuts),
   *  need = the need a transition tree's action answers (a filled box).
   *  For a PDPC (pdpc()): start, step, risk (what could go wrong: a danger hexagon), measure (what to do then), goal. */
  role?: CauseRole;
  /** Overrides the tone the role gives. */
  tone?: BoxTone;
  /** The core driver mark: a thick frame and a 中核 badge. causeTree({coreDriver: true}) sets it; it is not a role. */
  core?: boolean;
  /** For a `trim` entity of a negative branch tree: the injection it is folded into ("施策 1"). Drawn as a line under the label (→ 施策 1 に組み込む); the injection need not be in the figure. */
  foldsInto?: string;
  /** For a `de` or `goal` entity of a future reality tree given `mirrors` (see CauseOpts): the id of the undesirable effect of the current reality tree it answers. */
  mirrors?: string;
}
export interface CauseLink {
  /** The cause. An array is an AND: the causes together are sufficient (or needed), joined by an arc across their arrows. */
  from: string | readonly string[];
  /** The effect (or, in a prerequisite tree, what the cause is needed for). */
  to: string;
  line?: 'solid' | 'dashed' | 'dotted';
  /** 'cause' (default) or 'blocks': this entity cuts that one (trimming; the negative branch). Drawn dashed and ending in a bar instead of an
   *  arrowhead; `from` is one entity; it is not an AND, and it is not counted as a cause (coreDriver). */
  kind?: 'cause' | 'blocks';
  /** This arrow is the return of a loop (a vicious circle's UDE back to its root cause): it is laid out as the way back, so the layers do not
   *  depend on the order the entities are written in, and it is drawn bold. One cause only (not with an array `from`); one per cycle. */
  back?: true;
}
/** The roles `roleTags` writes in words: the ones drawn with the same double accent frame. */
export type RoleTagged = 'root' | 'goal' | 'injection' | 'start';
export interface CauseOpts extends RevealOpts, ScopeOpts {
  /** Which way the arrows run: 'up' (default: causes at the bottom, effects at the top), 'down', 'right' or 'left'.
   *  'auto' (and leaving it out) lets the layout narrow the nodes when the figure is wider than the diagram (a warning when left out, a note for 'auto');
   *  a cause tree never changes its axis. Writing a direction fixes it: the figure that does not fit is an error that lists what was tried. */
  dir?: 'up' | 'down' | 'right' | 'left' | 'auto';
  /** The widest a node grows (default 200px). Written as a number, it is never narrowed to make the figure fit. 'auto' (ADR 0019 D2) looks for the widest value from 260 down to 100
   *  that fits the figure's width and the canvas height (also when `dir` is written; a layer that is still too wide is folded). The height is approximate: the band's top is taken off the canvas height. */
  maxNodeW?: number | 'auto';
  /** Mark the core driver: the starting entity (nothing causes it) whose arrows bring about the most `ude` entities, 2 or more (a tie: all).
   *  Every starting entity gets the number it reaches under its text (`到達 UDE n`) unless `counts` is false. `role` is not changed. */
  coreDriver?: boolean;
  /** Write what kind of entity each starting / goal / measure entity is in words under its label (`【根本原因】`, `【ゴール】`, `【施策】`, `【開始】`), so that the entities drawn alike (a double accent frame) are told apart without colour or a legend. `true` uses these words; an object replaces some of them. Default off: nothing changes for a figure that does not write it. On the band this is the resolved map. */
  roleTags?: true | Partial<Record<RoleTagged, string>>;
  /** Show where a line crosses another (ADR 0028, 0035): `true` makes a return arrow hop over the lines it crosses; `'all'` also makes any arrow's run across the layers hop over the lines that run along the flow. A crossing next to a corner, an arrowhead, an AND arc or another crossing gets no hop (so not every crossing has one). Default off: nothing changes for a figure that does not write it. */
  hop?: boolean | 'all';
  /** Which Theory of Constraints tree this is: 'crt' (current reality), 'frt' (future reality), 'prt' (prerequisite), 'tt' (transition), 'nbr' (negative branch).
   *  Only a figure that says it is checked (the `toc-*` rules of `check`); not written, nothing is checked. It never changes the drawing. */
  tree?: 'crt' | 'frt' | 'prt' | 'tt' | 'nbr';
  /** Where an entity that nothing causes goes (ADR 0019 D1): 'asap' the first layer, 'alap' just before its nearest effect (a chain of such entities too; root, injection and start entities stay
   *  on the first layer). Default: 'alap' when `tree` is 'prt', 'frt' or 'tt', else 'asap' (the picture as it was). */
  layer?: 'asap' | 'alap';
  /** The current reality tree (the band causeTree() returned for tree: 'crt') this future reality tree answers: its `de` / `goal` entities name the `ude` they mirror (node `mirrors`), and `check`
   *  finds an unknown or doubled one and a `ude` nothing answers (`toc-mirror`). Only its ids are kept; its text is not read as part of this figure. */
  mirrors?: CauseBand;
  /** What `mirrors` leaves in the band: the ids of the current reality tree and of its undesirable effects. Set by causeTree(), not by the author. */
  mirrorOf?: {ids: string[]; udes: string[]};
  /** With coreDriver: write how many undesirable effects each starting entity reaches under it (default true). */
  counts?: boolean;
  /** The wording of that line: `{n}` is the number reached, `{total}` the number of `ude` entities (default `{n}/{total} 件に届く`). */
  coreDriverLabel?: string;
  /** Where a return (an arrow back to an earlier layer) that skips two layers or more runs: 'inline' (through the figure, over dummies) or 'outer' (in a lane
   *  outside the figure, 14px apart, the longest outermost). Default: the arrows written `back: true` run outside, the others inline; `pdpc` runs all of them outside
   *  (falling back to inline when that does not fit the width). Written explicitly, 'outer' that does not fit is an error. */
  returns?: 'inline' | 'outer';
  /** Lay the figure out with the plain coordinates only (default true: a straightened layout is used when it has strictly fewer crossings, then bends). `false` keeps the older picture. */
  straighten?: boolean;
  /** Cut a layer that is wider than the figure into rows, one above the other, and keep the direction (ADR 0010 D7). Only a figure that does not fit is changed.
   *  Default: tried last when `dir` is left out or 'auto' (after narrowing the nodes); `true` also when `dir` is written; `false` never. Only for 'up' and 'down'. */
  fold?: boolean;
  id?: string;
}
export interface CauseBand extends CauseOpts {
  /** What a band's maker (`pdpc()`) wants when `returns` is not written; like an explicit 'outer', but it falls back to inline when the lanes do not fit. */
  returnsDefault?: 'outer';
  type: 'cause';
  nodes: CauseNode[];
  links: CauseLink[];
  /** The direction when `dir` is left out, if not 'up' (pdpc and relationDiagram run 'down'): they may also turn to 'right' to fit. Set by the DSL, not by the author. */
  base?: 'down';
  /** `dir` was left out and the DSL wrote `base` into it: it counts as left out (may change), not as written. */
  dirLeftOut?: true;
  /** The findings of a cause-analysis tree (whyWhyTree), worked out when it was built. Read by the checks only; never drawn. */
  rca?: RcaInfo;
  /** Layers count from the effect (ADR 0026 D3): every entity, root causes too, sits one layer from its nearest effect, so "why n" is the same layer in every branch. Set by whyWhyTree(), not by the author. */
  layerFrom?: 'effect';
  /** Entities that are not anchors (no connect() / spotlight / reveal can name them, and two figures may use the same ids). Set by whyWhyTree() for the entities it named itself, not by the author. */
  unanchored?: readonly string[];
}
/** An answer to "なぜ?" in whyWhyTree(): what explains the node above it. `trueCause: true` marks the root cause; `measure` is what is done about it. */
export interface WhyNode {id?: string; why: string; because?: readonly WhyNode[]; trueCause?: true; measure?: string}
/** A threat or a consequence of a bow-tie, with the barriers between it and the top event, in the order the flow meets them. */
export interface BowtieSide {label: string; barriers?: readonly string[]}
export interface BowtieInput {
  /** What is controlled whose loss the top event is (drawn above the top event). */
  hazard?: string;
  /** The top event: the loss of control. (The band keeps it as `event`: a band with an id has the handle `.top`.) */
  top: string;
  /** Left of the top event: each with its preventive barriers, in the order the threat meets them. */
  threats: readonly BowtieSide[];
  /** Right of the top event: each with its mitigating barriers. */
  consequences: readonly BowtieSide[];
}
export interface BowtieOpts extends RevealOpts, ScopeOpts {
  /** The widest a box grows (default 200). Left out, it is narrowed (to 110) when the figure is wider than the diagram (a warning); 'auto' does the same as a note; a number is never narrowed. */
  maxNodeW?: number | 'auto';
  id?: string;
}
export interface BowtieBand extends BowtieOpts {
  type: 'bowtie';
  hazard?: string;
  event: string;
  threats: readonly BowtieSide[];
  consequences: readonly BowtieSide[];
}
export type BowtieRole = 'hazard' | 'threat' | 'barrier' | 'event' | 'consequence';
export interface LaidOutBowtie extends Rect, Dimmed {
  type: 'bowtie';
  id?: string;
  reveal?: number;
  until?: number;
  fitApplied?: FitApplied[];
  nodes: (Rect & {role: BowtieRole})[];
  /** The flow, left to right: a line, with an arrowhead where `arrow` says. */
  edges: {points: {x: number; y: number}[]; arrow: boolean}[];
  /** The knot above the top event's box. */
  knot: {cx: number; cy: number; r: number};
  texts: TreeNodeText[];
  anchors: Anchor[];
  labelBoxes: (Rect & {label: string})[];
}
export type CloudBox = string | {text: string; id?: string; tone?: BoxTone};
/** The arrow an assumption sits on: ab = B to A, ac = C to A, bd = D to B, cd = D' to C, dd = the conflict between D and D'. */
export type CloudArrow = 'ab' | 'ac' | 'bd' | 'cd' | 'dd';
export interface CloudAssumption {
  on: CloudArrow;
  text: string;
  /** A change that makes the assumption false (drawn under it, in the accent colour). */
  injection?: string;
}
export interface CloudOpts extends RevealOpts, ScopeOpts {
  assumptions?: CloudAssumption[];
  /** A word on the conflict arrow (default none). */
  conflictLabel?: string;
  maxNodeW?: number;
  id?: string;
}
export interface CloudBand extends CloudOpts {
  type: 'cloud';
  a: CloudBox; b: CloudBox; c: CloudBox; d: CloudBox; d2: CloudBox;
}
export interface ClassItem {
  id: string;
  /** Shown name (default: the id). */
  name?: string;
  /** «interface», «enum» ... above the name. */
  stereotype?: string;
  /** Shorthand for the stereotype «abstract». */
  abstract?: boolean;
  /** One line each: '- id: number'. */
  attrs?: string[];
  methods?: string[];
  tone?: BoxTone;
}
export type RelationKind = 'assoc' | 'arrow' | 'inherit' | 'implement' | 'compose' | 'aggregate' | 'depend';
export interface ClassRelation {
  from: string;
  to: string;
  /** 'assoc' a plain line (default) | 'arrow' directed association | 'inherit' from child to parent (hollow triangle at the parent) |
   *  'implement' dashed, triangle at the interface | 'compose' / 'aggregate' diamond (filled / hollow) on `from`, the whole | 'depend' dashed open arrow. */
  kind?: RelationKind;
  label?: string;
  /** Multiplicity near each end ('1', '0..*'). */
  fromMult?: string;
  toMult?: string;
}
export interface ClassesOpts extends RevealOpts, ScopeOpts {
  /** 'down' (default): parents on top. 'right': left to right.
   *  'auto' (and leaving it out) lets the layout turn to the other direction when the figure is wider than the diagram (a warning when left out,
   *  a note for 'auto'). Writing a direction fixes it: a figure that does not fit is an error that lists what was tried. */
  dir?: 'down' | 'right' | 'auto';
  /** Lay the figure out with the plain coordinates only (default true: a straightened layout is used when it has strictly fewer crossings, then bends). `false` keeps the older picture. */
  straighten?: boolean;
  id?: string;
}
export interface ClassesBand extends ClassesOpts {
  type: 'classes';
  classes: ClassItem[];
  relations: ClassRelation[];
}
export type BpmnNodeKind = 'task' | 'start' | 'end' | 'xor' | 'and' | 'or';
export interface BpmnLane {id: string; label: string; tone?: BoxTone}
export interface BpmnNode {
  id: string;
  lane: string;
  /** A task needs one; an event or gateway may have one (drawn under the shape). */
  label?: string;
  /** A task's second, muted line. */
  sub?: string;
  /** 'task' (default) | 'start' / 'end' event | 'xor' exclusive, 'and' parallel, 'or' inclusive gateway. */
  kind?: BpmnNodeKind;
  tone?: BoxTone;
  /** A task only: an installed SVG icon (see `icon`) above the label, 20px, in the node's text tone (or `iconTone`). The label carries the meaning, so the icon is `aria-hidden`. */
  icon?: IconName;
  iconTone?: TextTone;
  /** Internal: the installed path of `icon`, resolved by bpmn(). */
  iconGlyph?: IconGlyph;
}
export interface BpmnFlow {
  from: string;
  to: string;
  /** A condition on a flow out of a gateway ('承認'). */
  label?: string;
  /** 'dashed': a message flow between lanes (default: a sequence flow, solid). */
  line?: 'solid' | 'dashed';
}
export interface BpmnOpts extends RevealOpts, ScopeOpts {
  id?: string;
  /** 'shrink': when the figure is wider than the diagram, narrow the lane-name column, the column gaps and the task boxes step by step until it fits (default: throw). */
  fit?: 'shrink';
}
export interface BpmnBand extends BpmnOpts {
  type: 'bpmn';
  lanes: BpmnLane[];
  nodes: BpmnNode[];
  flows: BpmnFlow[];
}
/** One thing the layout changed on its own to make a figure fit its width (ADR 0010); the `auto-fit-applied` rule reads it. */
export interface FitApplied {
  /** What changed: the direction, the node width, or a layer folded into rows. */
  what: 'dir' | 'maxNodeW' | 'fold';
  from: string | number;
  to: string | number;
  /** The figure's width before and after, in px. */
  wasW?: number;
  nowW?: number;
  /** How the author asked for it: `dir` left out (a warning) or `dir: 'auto'` (a note), or the change was asked for (`fold: true`). */
  mode: 'omitted' | 'auto' | 'written';
}
export interface TreeNodeText extends Dimmed {text: string; x: number; y: number; size: number; bold: boolean; muted: boolean}
export interface LaidOutTree extends Rect, Dimmed {
  type: 'tree';
  /** What the layout changed on its own to fit the width (none: the figure is as written). */
  fitApplied?: FitApplied[];
  id?: string;
  reveal?: number;
  until?: number;
  nodes: (Rect & {tone: BoxTone; id?: string; /** ADR 0034 */ dataNode?: string})[];
  /** Parent to child, each a polyline (centre line of the box edge to the child's box edge); `curve` draws it as a smooth S, `bold` as a spine. */
  edges: {points: {x: number; y: number}[]; curve?: 'x' | 'y'; bold?: boolean}[];
  /** brace maps: a `{` over the children of one parent. */
  braces?: {x: number; y1: number; y2: number; ymid: number; tipX: number; side: 'right' | 'left'}[];
  texts: TreeNodeText[];
  /** Nodes with an id: what connect() can reach. */
  anchors: Anchor[];
  labelBoxes: (Rect & {label: string})[];
}
export interface LaidOutStates extends Rect, Dimmed {
  type: 'states';
  /** What the layout changed on its own to fit the width (none: the figure is as written). */
  fitApplied?: FitApplied[];
  id?: string;
  reveal?: number;
  until?: number;
  nodes: (Rect & {tone: EmphasisTone; final?: boolean; circle?: boolean})[];
  initial?: {x: number; y: number; r: number};
  /** Orthogonal polylines from the tail state's box edge to the head's; the arrowhead is at the last point. */
  edges: {from: string; to: string; points: {x: number; y: number}[]; line: 'solid' | 'dashed' | 'dotted'; tone?: 'danger' | 'accent' | 'muted'; strong?: boolean}[];
  texts: TreeNodeText[];
  /** The icons of the states that have one (24px, above the label); `node` indexes `nodes`. */
  icons: {node: number; name: string; glyph: IconGlyph; x: number; y: number; size: number}[];
  /** Transition labels: a white chip (x, y, w, h) with its text baseline at (tx, ty), in `size` px. */
  labels: (Rect & {text: string; tx: number; ty: number; size: number; /** index of its arrow in `edges` */ edge: number})[];
  anchors: Anchor[];
  labelBoxes: (Rect & {label: string})[];
}
export interface LaidOutCause extends Rect, Dimmed {
  type: 'cause';
  /** The ids no author name answers to (whyWhyTree's own): in `anchors`, but not in the registry or a spotlight scope. */
  unanchored?: readonly string[];
  /** What the layout changed on its own to fit the width (none: the figure is as written). */
  fitApplied?: FitApplied[];
  id?: string;
  reveal?: number;
  until?: number;
  nodes: (Rect & {tone: EmphasisTone; /** ADR 0034: the name `data-node` carries on the frame */ dataNode?: string; double?: boolean; /** the core driver: a thick frame and a badge */ core?: boolean; /** an obstacle is a hexagon, as in a prerequisite tree */ hex?: boolean; /** a dashed frame (a trim) */ dashed?: boolean})[];
  /** Orthogonal polylines from the cause's box edge to the effect's; the arrowhead is at the last point. */
  edges: {from: string; to: string; points: {x: number; y: number}[]; line: 'solid' | 'dashed' | 'dotted'; /** a declared return (`back: true`): drawn bold */ back?: true; /** runs in a lane outside the figure (a return that skips two layers or more, see `returns`) */ outer?: true; /** only a cutting arrow has it */ kind?: 'blocks'; /** a return the layout turned around (`back`, an outer lane, or a cycle it cut), only with `hop` */ reversed?: true}[];
  /** Only with `hop` (ADR 0028): where a return crosses another line, by index into `edges`; `skipped` says why that one gets no hop. */
  crossings?: {over: number; under: number; x: number; y: number; side: {x: number; y: number}; skipped?: string}[];
  /** The arc across the arrows of an AND: a quadratic curve p0 - c - p1. */
  ands: {to: string; /** the causes it joins */ from: string[]; p0: {x: number; y: number}; c: {x: number; y: number}; p1: {x: number; y: number}}[];
  /** Effects whose AND arrows could not be joined by an arc (they do not arrive on one side of the effect). */
  loose: string[];
  texts: TreeNodeText[];
  anchors: Anchor[];
  labelBoxes: (Rect & {label: string})[];
}
export interface LaidOutCloud extends Rect, Dimmed {
  type: 'cloud';
  id?: string;
  reveal?: number;
  until?: number;
  /** key: a b c d d2 */
  nodes: (Rect & {key: string; tone: BoxTone; id?: string})[];
  /** Arrows of the needs (head at the last point) and, for 'dd', the double-headed conflict zigzag. */
  edges: {arrow: CloudArrow; points: {x: number; y: number}[]}[];
  /** The assumption numbers on an arrow: a white chip, text baseline at (tx, ty). */
  chips: (Rect & {text: string; tx: number; ty: number; size: number; arrow: CloudArrow; conflict?: boolean})[];
  texts: (TreeNodeText & {anchor?: 'start' | 'middle' | 'end'; tone?: 'accent' | 'danger'})[];
  anchors: Anchor[];
  labelBoxes: (Rect & {label: string})[];
}
export interface LaidOutClasses extends Rect, Dimmed {
  type: 'classes';
  /** What the layout changed on its own to fit the width (none: the figure is as written). */
  fitApplied?: FitApplied[];
  id?: string;
  reveal?: number;
  until?: number;
  /** `dividers`: the y of the lines between name / attributes / methods. */
  nodes: (Rect & {tone: BoxTone; dividers: number[]})[];
  /** Orthogonal polylines from `from`'s box to `to`'s (the end marks come from `kind`: at the end for inherit / implement / arrow / depend, at the start for compose / aggregate). */
  edges: {from: string; to: string; kind: RelationKind; line: 'solid' | 'dashed'; points: {x: number; y: number}[]}[];
  texts: GanttText[];
  /** Relation labels and multiplicities: a white chip with its text baseline at (tx, ty), in `size` px; `edge` is the index of its relation in `edges`. */
  labels: (Rect & {text: string; tx: number; ty: number; size: number; edge: number})[];
  anchors: Anchor[];
  labelBoxes: (Rect & {label: string})[];
}
export interface LaidOutBpmn extends Rect, Dimmed {
  type: 'bpmn';
  /** With `fit: 'shrink'`: the tasks whose label broke into lines of 2.5 characters or fewer on average (the shrink-narrow-text rule reads it). */
  narrow?: string[];
  id?: string;
  reveal?: number;
  until?: number;
  lanes: (Rect & {labelW: number; tone: BoxTone})[];
  /** The shape of each node (a circle, a diamond or a rounded rectangle). */
  nodes: (Rect & {kind: BpmnNodeKind; tone: BoxTone; /** ADR 0034 */ dataNode?: string})[];
  /** The icons of the tasks that have one (20px, above the label); `node` indexes `nodes`. */
  icons: {node: number; name: string; glyph: IconGlyph; x: number; y: number; size: number; tone?: TextTone}[];
  edges: {from: string; to: string; line: 'solid' | 'dashed'; points: {x: number; y: number}[]}[];
  texts: GanttText[];
  /** Flow conditions: a white chip with its text baseline at (tx, ty), in `size` px; `edge` is the index of its flow in `edges`. */
  labels: (Rect & {text: string; tx: number; ty: number; size: number; edge: number})[];
  anchors: Anchor[];
  labelBoxes: (Rect & {label: string})[];
}

/** What a fault tree event is (ADR 0025 D2): the output of a gate (a rectangle, the default), a basic event (a circle), one left undeveloped (a diamond), a house event (a house), or the condition of an inhibit gate (an ellipse). */
export type FtaKind = 'event' | 'basic' | 'undeveloped' | 'house' | 'condition';
export type FtaGate = 'and' | 'or' | 'vote' | 'inhibit';
export interface FtaEvent {
  /** Names the event: another place can repeat it with `{ref: id}`, and connect() / spotlight / reveal can reach it. */
  id?: string;
  /** The text of the event (not for a `{ref}`). */
  label?: string;
  /** A second, muted line. */
  sub?: string;
  kind?: FtaKind;
  /** The gate under the event (`kind: 'event'` needs one, with `children`). */
  gate?: FtaGate;
  children?: FtaEvent[];
  /** `vote`: the event happens when `k` of the inputs do (1 <= k <= number of inputs). */
  k?: number;
  /** `inhibit`: the condition event (one input in `children`, one condition here). */
  condition?: FtaEvent;
  /** The probability of a basic / undeveloped / condition event, 0 to 1. */
  p?: number;
  /** A house event: true = it always happens, false = it never does. */
  state?: boolean;
  /** Draw the event that has this `id` again (a basic, undeveloped, house or condition event only); no other field. */
  ref?: string;
}
export interface FtaOpts extends RevealOpts, ScopeOpts {
  /** The widest an event box grows (default 200). Left out, it is narrowed (to 110) when the tree is wider than the diagram (a warning);
   *  'auto' does the same as a note; a number is never narrowed (a tree that does not fit is an error). */
  maxNodeW?: number | 'auto';
  /** Mark the events that alone bring the top event about (the minimal cut sets of size 1) with a heavy outline and a badge. Throws when the tree has too many cut sets to find them. */
  cutSets?: boolean;
  /** Work out the probability of the top event from the `p` of the events (independent events; every basic event needs `p`) and write it under the tree. */
  quant?: boolean;
  /** The period `p` is over, written in the note (`quant` only): '1 年間'. */
  quantPeriod?: string;
  id?: string;
}
export interface FtaBand extends FtaOpts {
  type: 'fta';
  /** The top event, with the tree under it (not `top`: a band with an id has the handle `.top`). */
  root: FtaEvent;
}
export interface LaidOutFta extends Rect, Dimmed {
  type: 'fta';
  id?: string;
  reveal?: number;
  until?: number;
  fitApplied?: FitApplied[];
  /** The box of each event drawn (a `ref` draws its event again; only the first has `id`). */
  nodes: (Rect & {kind: FtaKind; id?: string})[];
  /** The symbol under a basic / undeveloped / house / condition event. */
  marks: (Rect & {kind: FtaKind; single?: true})[];
  /** The note under the tree (opts `quant`): the probability of the top event and what it assumes. */
  note?: string;
  /** The label under a single point of failure (opts `cutSets`). */
  badges: (Rect & {text: string; size: number})[];
  gates: (Rect & {gate: FtaGate; label?: {text: string; size: number}})[];
  /** Gate output to event, gate input to its children, inhibit gate to its condition. */
  edges: {points: {x: number; y: number}[]}[];
  texts: TreeNodeText[];
  anchors: Anchor[];
  labelBoxes: (Rect & {label: string})[];
}
