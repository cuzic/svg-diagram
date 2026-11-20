// The spec part without a type (ADR 0069 D4): `board`, boxes and framed groups placed by named areas and joined by links. It builds the
// same DSL calls a source writes (areas() with box / group / caption in its cells, group([areas(…)]) inside, connect({via})), so the
// figure is the same SVG from TS and from JSON. Nothing here places anything: the layout is areas()'s.
//
// A node is one flat object with a `kind` (box by default) rather than a oneOf per kind: validateOneOf picks an object branch by a
// const or required field, and a box leaves its kind out. check() turns away the fields that do not belong to the kind, at their place.
import {areas, box, caption, connect, group} from '../dsl-pure.ts';
import {AREAS_MAX_TRACKS, parseAreaTemplate} from '../areas.ts';
import type {AreaTemplate} from '../areas.ts';
import {ARROW, LINE, TEXT_TONE, id, items, list, object, oneOf, text} from '../spec-kit.ts';
import type {Json, JsonSchema, PartDef, SpecIssue} from '../spec-kit.ts';
import type {TrackPlace} from '../types/containers.ts';

/** Nodes of a board, the nested ones included. */
export const BOARD_MAX_NODES = 24;
export const BOARD_MAX_LINKS = 40;
/** Children of one group. */
export const BOARD_MAX_CHILDREN = 8;
/** board → group → group → box: a group inside a group holds no further group. */
const MAX_DEPTH = 3;
/** The name of an area (what areas() takes; lib/areas.ts). */
const NAME = /^[A-Za-z][A-Za-z0-9_-]*$/;

type Kind = 'box' | 'group' | 'caption';
const FIELDS: Record<Kind, readonly string[]> = {
  box: ['id', 'kind', 'title', 'body', 'lines', 'tone', 'stamp'],
  group: ['id', 'kind', 'title', 'tone', 'dashed', 'valign', 'children', 'areas', 'cols', 'gap', 'rowGap'],
  caption: ['id', 'kind', 'text', 'bold', 'tone'],
};
const REQUIRED: Record<Kind, string> = {box: 'title', group: 'children', caption: 'text'};
const TONES: Record<Kind, readonly string[]> = {
  box: ['plain', 'accent', 'new', 'changed', 'removed', 'muted', 'danger', 'solid', 'solid-danger'],
  group: ['plain', 'accent', 'new', 'changed', 'removed', 'muted', 'danger'],
  caption: ['text', 'accent', 'muted', 'danger'],
};
const SIDE = oneOf('left', 'right', 'top', 'bottom');
type Side = 'left' | 'right' | 'top' | 'bottom';

const AREAS = (where: string): JsonSchema => ({
  ...list(text("A row: the ids of the nodes, separated by spaces, '.' for an empty cell.", 160), AREAS_MAX_TRACKS, 1),
  description: `Where ${where} sit, as in CSS grid-template-areas: one string per row, one name (a node id) or '.' per cell, the same number of cells in every row. An id written in several cells covers them, and they must form a rectangle (so a node can span columns or rows). Every node needs exactly one area. At most ${AREAS_MAX_TRACKS} columns and ${AREAS_MAX_TRACKS} rows.`,
});
const COLS: JsonSchema = {...list({type: 'number', minimum: 0.1, maximum: 100}, AREAS_MAX_TRACKS, 1), description: 'The width ratio of each column of areas (default: equal), one per column, such as [4, 3, 4].'};
const GAP: JsonSchema = {type: 'integer', minimum: 0, maximum: 160, description: 'The space between the columns in px (default 16, rounded up to a multiple of 4). It widens by itself when a labelled link needs room and the columns can give it; keep labels short.'};
const ROW_GAP: JsonSchema = {type: 'integer', minimum: 0, maximum: 160, description: 'The space between the rows in px (default: gap).'};

/** A nested node's field without its description, and its items' too: the top-level node's say what it is (the catalog stays small). */
const short = ({description: _d, ...s}: JsonSchema): JsonSchema => s.items ? {...s, items: short(s.items)} : s;

function nodeSchema(depth: number): JsonSchema {
  const top = depth === 1, nests = depth < MAX_DEPTH;
  const d = (s: JsonSchema): JsonSchema => top ? s : short(s);
  const kinds = nests ? ['box', 'group', 'caption'] : ['box', 'caption'];
  return object({
    id: id(top
      ? "The node's name: its area in areas, and what links name. ASCII letters, digits, _ and -, starting with a letter."
      : "Needed when the group has areas (then written like an area name), or when a link names the node; otherwise leave it out. Must not contain ':' or '@'."),
    kind: {...oneOf(...kinds), description: top ? 'box (default): a box with a title. group: a frame with a name round its children. caption: a line of text, which links cannot join.' : nests ? 'box (default), group or caption.' : 'box (default) or caption: no group at this level (a group inside a group holds no further group).'},
    title: d(text('box: the heading (required). group: the name on the frame.', 60)),
    body: d(text('box: a second, smaller text.', 120)),
    lines: d({...list(text('One line.', 60), 8, 1), description: 'box: lines under the title, drawn as a list.'}),
    tone: d({...oneOf(...new Set([...TONES.box, ...TONES.caption])), description: 'box: plain, accent, new, changed, removed, muted, danger, solid or solid-danger. group: the same without solid and solid-danger (default muted). caption: text, accent, muted (default) or danger.'}),
    stamp: d(text('box: a short tag on the corner.', 20)),
    ...(nests ? {
      dashed: d({type: 'boolean', description: 'group: a dashed frame.'}),
      valign: d({...oneOf('top', 'center', 'stretch'), description: 'group: where the children sit when the frame is taller than they are (default center).'}),
      children: {...list(nodeSchema(depth + 1), BOARD_MAX_CHILDREN, 1), description: top ? 'group (required): the nodes in the frame: boxes, captions and groups (a group in a group holds no further group). Stacked top to bottom, unless the group has areas.' : 'group (required): boxes and captions, no group.'},
      areas: top ? AREAS("a group's children") : short(AREAS('')),
      cols: top ? {...COLS, description: `group, with areas: ${COLS.description}`} : short(COLS),
      gap: top ? {...GAP, description: `group, with areas: ${GAP.description}`} : short(GAP),
      rowGap: top ? {...ROW_GAP, description: `group, with areas: ${ROW_GAP.description}`} : short(ROW_GAP),
    } : {}),
    text: d(text('caption: the line of text (required).', 120)),
    bold: d({type: 'boolean', description: 'caption: bold text.'}),
  }, top ? ['id'] : [], top ? 'A box, a group or a caption, by kind. Each kind takes only its own fields (the descriptions say which).' : 'A box, a group or a caption: the fields mean what they mean in a top-level node.');
}

const LINK: JsonSchema = object({
  from: id('The id of a box or a group of this board.'),
  to: id('The id of a box or a group of this board.'),
  fromSide: {...SIDE, description: 'The side the arrow leaves from. Left out, it follows from where the two nodes sit: side by side in areas gives right / left, one above the other gives bottom / top, and in a group without areas (a stack) the one written first is on top. Give both sides when the nodes sit diagonally, or when one node is inside the other.'},
  toSide: {...SIDE, description: 'The side the arrow arrives at; left out, as fromSide.'},
  label: text('The text on the arrow.', 40),
  chip: {type: 'boolean', description: 'true: the label in a pill on the line.'},
  line: LINE,
  tone: TEXT_TONE,
  arrow: ARROW,
  route: {...oneOf('straight', 'elbow'), description: 'straight (default) or elbow (right angles).'},
  via: {...oneOf('from', 'to', 'both'), description: "Stop that end on the frame of the group around its box, instead of on the box: the outermost group round it that does not hold the other end ('both': every end that sits in a group). The end must be a box inside a group."},
}, ['from', 'to']);

interface Node {node: Json; path: string; kind: Kind; depth: number; index: number; parent: Node | null}
/** Where a board's or a group's children sit: by area, in a stack (null), or not known because its template is wrong (undefined). */
interface Container {place: Map<string, TrackPlace> | null | undefined}

const kindOf = (n: Json): Kind => (n['kind'] as Kind | undefined) ?? 'box';
const strip = (message: string): string => message.replace(/^areas\(template\): /, '');
/** The template of a board without areas: its nodes in one row, in the order written. */
const oneRow = (nodes: readonly Json[]): string => nodes.map(n => String(n['id'])).join(' ');

/**
 * The template of a board or a group, checked against the ids of its children and the column ratios; undefined when it is wrong (the
 * issues say why). `given` is false for the one row a board without areas takes: its mistakes are the ids', reported at the ids.
 */
function template(rows: readonly string[], at: string, part: Json, partAt: string, children: readonly Node[], given: boolean, issues: SpecIssue[]): Map<string, TrackPlace> | undefined {
  let t: AreaTemplate;
  try { t = parseAreaTemplate(rows); } catch (e) {
    const message = strip(e instanceof Error ? e.message : String(e)), line = /\bline (\d+)/.exec(message)?.[1];
    // a name the ids already got wrong is reported there, once
    const told = children.some(c => typeof c.node['id'] === 'string' && !NAME.test(c.node['id']) && message.includes(`"${c.node['id']}"`));
    if (given && !told) issues.push({path: line ? `${at}[${Number(line) - 1}]` : at, message});
    return undefined;
  }
  const ids = children.map(c => c.node['id']);
  const missing = t.names.filter(n => !ids.includes(n));
  if (missing.length) issues.push({path: at, message: `names ${missing.map(n => `"${n}"`).join(', ')}, which no node has as its id (ids: ${ids.filter(x => typeof x === 'string').join(', ')})`});
  for (const c of children) {
    const v = c.node['id'];
    if (typeof v === 'string' && NAME.test(v) && !t.names.includes(v)) issues.push({path: `${c.path}.id`, message: `"${v}" is not in areas: give every node an area (${t.names.join(', ')})`});
  }
  const cols = part['cols'];
  if (Array.isArray(cols) && cols.length !== t.cols) issues.push({path: `${partAt}.cols`, message: `has ${cols.length} ratio(s); ${given ? 'areas has' : 'the nodes make one row of'} ${t.cols} column(s)`});
  return missing.length ? undefined : t.place;
}

/** Everything about the nodes: the fields of each kind, the ids, the nesting, the templates. Returns the nodes by id and the containers. */
function walk(part: Json, at: string, issues: SpecIssue[]): {byId: Map<string, Node>; all: Node[]; containers: Map<Node | null, Container>} {
  const byId = new Map<string, Node>(), all: Node[] = [], containers = new Map<Node | null, Container>();
  const visit = (list: readonly Json[], listPath: string, depth: number, parent: Node | null, named: boolean): Node[] => list.map((n, i) => {
    const path = `${listPath}[${i}]`, kind = kindOf(n), node: Node = {node: n, path, kind, depth, index: i, parent};
    all.push(node);
    for (const k of Object.keys(n)) if (!FIELDS[kind].includes(k)) {
      const owners = (Object.keys(FIELDS) as Kind[]).filter(o => FIELDS[o].includes(k)).map(o => `kind: '${o}'`);
      issues.push({path: `${path}.${k}`, message: `is not a field of a ${kind} (a ${kind} takes ${FIELDS[kind].filter(f => f !== 'kind').join(', ')})${owners.length ? `; it belongs to ${owners.join(' or ')}` : ''}`});
    }
    if (n[REQUIRED[kind]] === undefined) issues.push({path: `${path}.${REQUIRED[kind]}`, message: `is required for a ${kind}`});
    if (typeof n['tone'] === 'string' && !TONES[kind].includes(n['tone'])) issues.push({path: `${path}.tone`, message: `"${n['tone']}" is not a tone of a ${kind} (${TONES[kind].join(', ')})`});
    const v = n['id'];
    if (named && v === undefined) issues.push({path: `${path}.id`, message: 'is required: a node placed by areas is named by its id'});
    if (typeof v === 'string') {
      if (named && !NAME.test(v)) issues.push({path: `${path}.id`, message: `"${v}" names an area: write it with ASCII letters, digits, _ and -, starting with a letter`});
      else if (/[:@]/.test(v)) issues.push({path: `${path}.id`, message: `"${v}" must not contain ':' or '@' (a link reads what follows them as a side and a position)`});
      if (byId.has(v)) issues.push({path: `${path}.id`, message: `"${v}" is used twice (ids must be unique in the board, groups included)`});
      else byId.set(v, node);
    }
    if (kind === 'group') {
      const tpl = n['areas'] as string[] | undefined;
      if (tpl === undefined) for (const k of ['cols', 'gap', 'rowGap']) if (n[k] !== undefined) issues.push({path: `${path}.${k}`, message: 'needs areas: without areas a group stacks its children top to bottom'});
      const kids = visit(items(n, 'children'), `${path}.children`, depth + 1, node, tpl !== undefined);
      containers.set(node, {place: tpl === undefined ? null : template(tpl, `${path}.areas`, n, path, kids, true, issues)});
    }
    return node;
  });
  const tpl = part['areas'] as string[] | undefined, nodes = items(part, 'nodes');
  const top = visit(nodes, `${at}.nodes`, 1, null, true);
  let place: Map<string, TrackPlace> | undefined;
  if (tpl !== undefined) place = template(tpl, `${at}.areas`, part, at, top, true, issues);
  else if (nodes.length > AREAS_MAX_TRACKS) issues.push({path: `${at}.areas`, message: `is required with more than ${AREAS_MAX_TRACKS} nodes (there are ${nodes.length}): without it the nodes go in one row, and a row has at most ${AREAS_MAX_TRACKS} columns`});
  else place = template([oneRow(nodes)], `${at}.nodes`, part, at, top, false, issues);
  containers.set(null, {place});
  if (all.length > BOARD_MAX_NODES) issues.push({path: `${at}.nodes`, message: `has ${all.length} nodes with the ones in groups; the limit is ${BOARD_MAX_NODES}`});
  return {byId, all, containers};
}

/** The node and the groups round it, outermost first. */
const chain = (n: Node): Node[] => n.parent ? [...chain(n.parent), n] : [n];

/** The sides a link between `a` and `b` takes from where they sit, a reason it cannot tell, or null when a wrong template hides it. */
function sidesOf(a: Node, b: Node, containers: Map<Node | null, Container>): [Side, Side] | string | null {
  const ca = chain(a), cb = chain(b);
  let k = 0;
  while (k < ca.length && k < cb.length && ca[k] === cb[k]) k++;
  if (k === ca.length || k === cb.length) return `one end is inside the other (${k === ca.length ? 'from' : 'to'} holds the other end), so their places say no side`;
  const holder = k === 0 ? null : ca[k - 1] as Node, x = ca[k] as Node, y = cb[k] as Node;
  const place = containers.get(holder)?.place;
  if (place === null) return x.index < y.index ? ['bottom', 'top'] : ['top', 'bottom']; // a stack: the one written first is on top
  const p = place?.get(x.node['id'] as string), q = place?.get(y.node['id'] as string);
  if (!p || !q) return null;
  const colsMeet = p.col < q.col + q.cs && q.col < p.col + p.cs, rowsMeet = p.row < q.row + q.rs && q.row < p.row + p.rs;
  if (!colsMeet && rowsMeet) return p.col < q.col ? ['right', 'left'] : ['left', 'right'];
  if (colsMeet && !rowsMeet) return p.row < q.row ? ['bottom', 'top'] : ['top', 'bottom'];
  return 'their areas sit diagonally (neither side by side nor one above the other)';
}

function checkLinks(part: Json, at: string, byId: Map<string, Node>, containers: Map<Node | null, Container>, issues: SpecIssue[]): void {
  const linkable = [...byId.entries()].filter(([, n]) => n.kind !== 'caption').map(([k]) => k);
  items(part, 'links').forEach((l, i) => {
    const path = `${at}.links[${i}]`, ends: (Node | undefined)[] = [];
    for (const k of ['from', 'to'] as const) {
      const v = l[k] as string, n = byId.get(v);
      if (!n) issues.push({path: `${path}.${k}`, message: `"${v}" is not a box or a group of this board (known: ${linkable.join(', ') || 'none'}). A link joins the nodes of one board`});
      else if (n.kind === 'caption') issues.push({path: `${path}.${k}`, message: `"${v}" is a caption: a link joins boxes and groups`});
      ends.push(n && n.kind !== 'caption' ? n : undefined);
    }
    const [a, b] = ends;
    if (!a || !b) return;
    if (a === b) { issues.push({path: `${path}.to`, message: 'is the same node as from'}); return; }
    if (l['fromSide'] === undefined || l['toSide'] === undefined) {
      const sides = sidesOf(a, b, containers);
      if (typeof sides === 'string') issues.push({path: `${path}.${l['fromSide'] === undefined ? 'fromSide' : 'toSide'}`, message: `is needed: ${sides}. Write fromSide and toSide (left, right, top, bottom)`});
    }
    const seen = items(part, 'links').findIndex(m => JSON.stringify(m) === JSON.stringify(l));
    if (seen < i) issues.push({path, message: `is the same link as links[${seen}]: keep one`});
    const via = l['via'];
    if (via === undefined) return;
    // an end stops on a frame round it that does not hold the other end (D2)
    const framed = (n: Node, other: Node) => chain(n).slice(0, -1).some(g => !chain(other).includes(g));
    const fits = (n: Node, other: Node, which: string): string | null => n.kind === 'group'
      ? `${which} ("${String(n.node['id'])}") is a group: a link to a group already stops on its frame — drop via`
      : framed(n, other) ? null : `${which} ("${String(n.node['id'])}") is not inside a group that leaves out the other end — drop via, or put the box in a group`;
    const why = via === 'from' ? fits(a, b, 'from') : via === 'to' ? fits(b, a, 'to') : framed(a, b) || framed(b, a) ? null : 'neither end is inside a group that leaves out the other end — drop via, or put a box in a group';
    if (why) { issues.push({path: `${path}.via`, message: why}); return; }
    // a written side of an end that stops on a frame must face the other end, or the line crosses the frame
    for (const [k, n, other] of [['fromSide', a, b], ['toSide', b, a]] as const) {
      const side = l[k] as Side | undefined, stops = n.kind === 'box' && (via === 'both' || via === (k === 'fromSide' ? 'from' : 'to')) && framed(n, other);
      if (side && stops && facing(n, other, side, containers) === false) issues.push({path: `${path}.${k}`, message: `"${side}" does not face the other end: via stops this end on the ${side} edge of the frame round it, so the line would cross the frame. Write the side that faces the other end, or leave the sides out`});
    }
  });
}

/**
 * Whether the frame `n` stops on (the area or the stacked child of the container that holds both ends) has `side` facing `other`:
 * false when it surely does not, true or null (not known: a wrong template) otherwise.
 */
function facing(n: Node, other: Node, side: Side, containers: Map<Node | null, Container>): boolean | null {
  const ca = chain(n), cb = chain(other);
  let k = 0;
  while (k < ca.length && k < cb.length && ca[k] === cb[k]) k++;
  const holder = k === 0 ? null : ca[k - 1] as Node, x = ca[k] as Node, y = cb[k];
  if (!y) return null;
  const place = containers.get(holder)?.place;
  if (place === null) return side === 'top' ? y.index < x.index : side === 'bottom' ? y.index > x.index : false; // a stack: one frame above the other
  const p = place?.get(x.node['id'] as string), q = place?.get(y.node['id'] as string);
  if (!p || !q) return null;
  // the frame fills its area, so the other end is outside the edge only if its area starts beyond it
  if (side === 'left') return q.col < p.col;
  if (side === 'right') return q.col + q.cs > p.col + p.cs;
  if (side === 'top') return q.row < p.row;
  return q.row + q.rs > p.row + p.rs;
}

const pick = (n: Json, keys: readonly string[]): Json => Object.fromEntries(keys.flatMap(k => n[k] === undefined ? [] : [[k, n[k]]]));
const areasOpts = (n: Json): Json => pick(n, ['cols', 'gap', 'rowGap']);

/** The band a node builds; a caption in a stack keeps no id (only an area names it). */
function build(n: Json): unknown {
  const kind = kindOf(n);
  if (kind === 'box') return box(pick(n, ['id', 'title', 'body', 'lines', 'tone', 'stamp']) as never);
  if (kind === 'caption') return caption(n['text'] as string, pick(n, ['bold', 'tone']) as never);
  const kids = items(n, 'children'), tpl = n['areas'] as string[] | undefined;
  const inner = tpl === undefined ? kids.map(build) : [areas(tpl, cellsOf(kids) as never, areasOpts(n) as never)];
  return group(inner as never, pick(n, ['id', 'title', 'tone', 'dashed', 'valign']) as never);
}
const cellsOf = (nodes: readonly Json[]): Json => Object.fromEntries(nodes.map(n => [n['id'] as string, build(n)]));

/** Every id of a board with its place, for the check across parts. */
function boardIds(part: Json, at: string): {id: string; path: string}[] {
  const out: {id: string; path: string}[] = [];
  // a caption in a stack is no anchor (only an area's name makes one: the frameless group areas() wraps it in)
  const walkIds = (list: readonly Json[], listPath: string, named: boolean) => list.forEach((n, i) => {
    if (typeof n['id'] === 'string' && (named || kindOf(n) !== 'caption')) out.push({id: n['id'], path: `${listPath}[${i}].id`});
    walkIds(items(n, 'children'), `${listPath}[${i}].children`, n['areas'] !== undefined);
  });
  walkIds(items(part, 'nodes'), `${at}.nodes`, true);
  return out;
}

export const BOARD: PartDef = {
  type: 'board',
  anchors: boardIds,
  description: `A free layout: boxes and framed groups placed by named areas, joined by arrows. Use it when the figure is a few blocks and the arrows between them, and no typed part names that shape (a memo that feeds several conversations, a trace across stages, layers with what slips through). Prefer a typed part when one fits: a comparison is compare or versus, a process is flowchart or steps. Each node is a box (default), a group (a named frame round up to ${BOARD_MAX_CHILDREN} children, stacked, or placed by the group's own areas) or a caption; a group in a group holds no further group. \`areas\` places the top-level nodes by their ids, one string per row like CSS grid-template-areas (left out: all in one row, in the order written; about 8 short boxes fit in one row of a document figure, so write areas for more); \`cols\` gives the column ratios. A node inside a group needs an id only when a link names it, or when its group has areas. A link joins two boxes or groups of this board; its sides follow from where the nodes sit, so write fromSide / toSide only for nodes that sit diagonally or one inside the other. \`via\` stops an end on the frame of the group around its box. At most ${BOARD_MAX_NODES} nodes (nested ones included) and ${BOARD_MAX_LINKS} links.`,
  schema: object({
    type: {const: 'board'},
    areas: AREAS('the top-level nodes'),
    cols: COLS,
    gap: GAP,
    rowGap: ROW_GAP,
    nodes: {...list(nodeSchema(1), BOARD_MAX_NODES, 1), description: `The boxes, groups and captions, nested ones included (at most ${BOARD_MAX_NODES} in all). Each top-level node needs an id, the name of its area.`},
    links: {...list(LINK, BOARD_MAX_LINKS), description: 'The arrows between boxes and groups.'},
  }, ['type', 'nodes']),
  example: {
    type: 'board', areas: ['head memo convs', '. note note'], cols: [4, 3, 4], gap: 64, rowGap: 16,
    nodes: [
      {id: 'head', kind: 'group', title: '担当者の頭の中', tone: 'muted', children: [{title: '提出先の手引き'}, {title: '社内ルール'}]},
      {id: 'memo', kind: 'group', title: '書き出す先', children: [{id: 'doc', title: '決定メモ', body: '1枚に書き出す'}]},
      {id: 'convs', kind: 'group', title: '同じ前提で始まる', tone: 'accent', children: [{id: 'c1', title: '今の会話'}, {id: 'c2', title: '新しい会話'}]},
      {id: 'note', kind: 'caption', text: '前提は 1 か所にだけ書く'},
    ],
    links: [{from: 'head', to: 'memo'}, {from: 'doc', to: 'c1', via: 'to'}],
  },
  check(part, at, issues) {
    const {byId, containers} = walk(part, at, issues);
    checkLinks(part, at, byId, containers, issues);
  },
  build(part) {
    const nodes = items(part, 'nodes');
    const tpl = (part['areas'] as string[] | undefined) ?? [oneRow(nodes)];
    // the places again (check() has passed, so every link has its sides)
    const issues: SpecIssue[] = [], {byId, containers} = walk(part, '', issues);
    const links = items(part, 'links').map(l => {
      const a = byId.get(l['from'] as string) as Node, b = byId.get(l['to'] as string) as Node;
      const inferred = l['fromSide'] === undefined || l['toSide'] === undefined ? sidesOf(a, b, containers) as [Side, Side] : null;
      const fromSide = (l['fromSide'] as Side | undefined) ?? (inferred as [Side, Side])[0], toSide = (l['toSide'] as Side | undefined) ?? (inferred as [Side, Side])[1];
      const via = l['via'] === 'from' ? {via: {from: 'group'}} : l['via'] === 'to' ? {via: {to: 'group'}} : l['via'] === 'both' ? {via: 'group'} : {};
      return connect(`${String(l['from'])}:${fromSide}`, `${String(l['to'])}:${toSide}`, {...pick(l, ['label', 'chip', 'line', 'tone', 'arrow', 'route']), ...via} as never);
    });
    return [areas(tpl, cellsOf(nodes) as never, areasOpts(part) as never), ...links];
  },
};
