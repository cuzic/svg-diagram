// bowtie(): a bow-tie diagram (ADR 0026 D4). Threats on the left, each through its preventive barriers, into the top event in the middle (the
// loss of control, under its hazard); out of it through the mitigating barriers to the consequences on the right. The flow runs left to right
// everywhere. A fixed layout: rows are the threats / consequences, columns are the barriers' places in a row; no layered or tree layout.
import {fitLayout} from './fit-width.ts';
import type {FitResult} from './fit-width.ts';
import {measureNode, nodeRuns} from './tree.ts';
import type {NodeLines} from './tree.ts';
import type {Roles, WidthOf} from './types/core.ts';
import type {BowtieBand, BowtieInput, BowtieRole, BowtieSide, LaidOutBowtie} from './types/diagrams.ts';

const COL_GAP = 32, BUS_GAP = 56, ROW_GAP = 20, KNOT_R = 14, STEM = 14, TOP_MIN_W = 150, TOP_MAX_LINES = 3;

const blank = (s: unknown): boolean => typeof s !== 'string' || !s.trim();

/** Validates the input (every error throws, naming the part). */
export function bowtieCheck(input: BowtieInput): void {
  if (!input || typeof input !== 'object') throw new Error('bowtie({top, threats, consequences}) needs the top event and the sides');
  if (blank(input.top)) throw new Error('bowtie(): top is the text of the top event (the loss of control)');
  if (input.hazard !== undefined && blank(input.hazard)) throw new Error('bowtie(): hazard is text (what is controlled), or leave it out');
  for (const [key, list] of [['threats', input.threats], ['consequences', input.consequences]] as const) {
    if (!Array.isArray(list) || list.length === 0) throw new Error(`bowtie(): ${key} needs at least one entry`);
    list.forEach((s: BowtieSide, i: number) => {
      if (!s || blank(s.label)) throw new Error(`bowtie(): ${key} ${i + 1} needs a label`);
      if (s.barriers !== undefined && !Array.isArray(s.barriers)) throw new Error(`bowtie(): "${s.label}": barriers is a list of texts`);
      (s.barriers ?? []).forEach((b, j) => { if (blank(b)) throw new Error(`bowtie(): "${s.label}": barrier ${j + 1} needs text`); });
    });
  }
}

const sideTexts = (list: BowtieSide[]): string[] => list.flatMap(s => [s.label, ...(s.barriers ?? [])]);
export function bowtieTextList(band: Pick<BowtieBand, 'hazard' | 'event' | 'threats' | 'consequences'>): string[] {
  return [...(band.hazard ? [band.hazard] : []), band.event, ...sideTexts(band.threats), ...sideTexts(band.consequences)];
}
export function bowtieMeasure(band: BowtieBand, roles: Roles): [string, number, number, 'sans'][] {
  return bowtieTextList(band).map(t => [t, roles.body, 700, 'sans'] as [string, number, number, 'sans']);
}

interface Item {role: BowtieRole; label: string; lines: NodeLines}
interface Attempt extends FitResult {
  maxW: number;
}

export function layoutBowtie(band: BowtieBand, x: number, y: number, w: number, widthOf: WidthOf, roles: Roles): LaidOutBowtie {
  bowtieCheck({hazard: band.hazard, top: band.event, threats: band.threats, consequences: band.consequences} as BowtieInput);
  const attempt = (maxW: number): Attempt => {
    const g = place(band, maxW, widthOf, roles);
    return {size: {w: g.w, h: g.h}, score: {crossings: 0, bends: 0}, maxW};
  };
  const auto = band.maxNodeW === 'auto';
  const written = typeof band.maxNodeW === 'number' ? band.maxNodeW : undefined;
  const fitted = fitLayout<'right', Attempt>({
    who: 'bowtie()', w, start: 'right', explicitDir: false, mode: auto ? 'auto' : 'omitted', noDir: true,
    axisKept: 'another direction (a bow-tie runs left to right)', ...(written === undefined ? {} : {maxNodeW: written}),
    build: (_d, maxW) => attempt(maxW), fix: 'a wider figure (diagram({width})), fewer barriers in a row, or shorter texts',
  });
  const g = place(band, fitted.result.maxW, widthOf, roles); // the attempt that fitted, placed again (the last one built is not always it)
  const dx = x + (w - g.w) / 2, dy = y;
  const out: LaidOutBowtie = {
    type: 'bowtie', ...(band.id === undefined ? {} : {id: band.id}), ...(band.reveal === undefined ? {} : {reveal: band.reveal}), ...(band.until === undefined ? {} : {until: band.until}),
    x, y, w, h: g.h,
    nodes: g.nodes.map(n => ({x: n.x + dx, y: n.y + dy, w: n.w, h: n.h, role: n.role})),
    edges: g.edges.map(e => ({arrow: e.arrow, points: e.points.map(p => ({x: p.x + dx, y: p.y + dy}))})),
    knot: {cx: g.knot.cx + dx, cy: g.knot.cy + dy, r: KNOT_R},
    texts: [], anchors: [], labelBoxes: [],
    ...(fitted.applied.length ? {fitApplied: fitted.applied} : {}),
  } as LaidOutBowtie;
  g.nodes.forEach((n, i) => {
    const r = out.nodes[i];
    out.labelBoxes.push({label: n.label, x: r.x, y: r.y, w: r.w, h: r.h});
    out.texts.push(...nodeRuns(r, n.lines, roles));
  });
  return out;
}

interface Placed {x: number; y: number; w: number; h: number; role: BowtieRole; label: string; lines: NodeLines}

function place(band: BowtieBand, maxW: number, widthOf: WidthOf, roles: Roles) {
  const measure = (label: string, role: BowtieRole, cap = maxW): Item => ({role, label, lines: measureNode(label, undefined, cap, widthOf, roles)});
  const left = band.threats.map(t => [measure(t.label, 'threat'), ...(t.barriers ?? []).map(b => measure(b, 'barrier'))]);
  const right = band.consequences.map(c => [...(c.barriers ?? []).map(b => measure(b, 'barrier')), measure(c.label, 'consequence')]);
  const top = measure(band.event, 'event', Math.max(maxW, TOP_MIN_W + 40));
  if (top.lines.label.length > TOP_MAX_LINES) throw new Error(`bowtie(): the top event "${band.event}" takes more than ${TOP_MAX_LINES} lines; shorten it`);
  const hazard = band.hazard ? measure(band.hazard, 'hazard', Math.max(maxW, TOP_MIN_W + 40)) : undefined;
  const topW = Math.max(TOP_MIN_W, top.lines.w, hazard?.lines.w ?? 0);
  // column widths: the k-th item of every row on a side shares one width, so the columns line up
  const widths = (rows: Item[][]): number[] => Array.from({length: Math.max(...rows.map(r => r.length))}, (_, k) => Math.max(...rows.map(r => r[k]?.lines.w ?? 0)));
  const lw = widths(left), rw = widths(right);
  const leftW = lw.reduce((a, b) => a + b, 0) + COL_GAP * (lw.length - 1), rightW = rw.reduce((a, b) => a + b, 0) + COL_GAP * (rw.length - 1);
  const totalW = leftW + BUS_GAP + topW + BUS_GAP + rightW;
  const rowH = (rows: Item[][]): number => Math.max(...rows.flat().map(i => i.lines.h));
  const slotL = rowH(left) + ROW_GAP, slotR = rowH(right) + ROW_GAP;
  const stackH = (hazard ? hazard.lines.h + STEM : 0) + 2 * KNOT_R + STEM + top.lines.h;
  const H = Math.max(left.length * slotL, right.length * slotR, stackH + ROW_GAP) - ROW_GAP;
  const nodes: Placed[] = [], edges: {points: {x: number; y: number}[]; arrow: boolean}[] = [];
  const topX = leftW + BUS_GAP, stackTop = (H - stackH) / 2;
  const cursor = stackTop;
  let cy0 = cursor;
  if (hazard) { nodes.push({x: topX + (topW - hazard.lines.w) / 2, y: cy0, w: hazard.lines.w, h: hazard.lines.h, role: 'hazard', label: hazard.label, lines: hazard.lines}); cy0 += hazard.lines.h + STEM; }
  const knot = {cx: topX + topW / 2, cy: cy0 + KNOT_R};
  cy0 += 2 * KNOT_R + STEM;
  const topRect: Placed = {x: topX + (topW - top.lines.w) / 2, y: cy0, w: Math.max(top.lines.w, topW), h: top.lines.h, role: 'event', label: top.label, lines: top.lines};
  topRect.x = topX; topRect.w = topW;
  nodes.push(topRect);
  const yk = topRect.y + topRect.h / 2;
  // the stem from the hazard to the knot, and from the knot to the box
  const mx = knot.cx;
  if (hazard) edges.push({points: [{x: mx, y: nodes[0].y + nodes[0].h}, {x: mx, y: knot.cy - KNOT_R}], arrow: false});
  edges.push({points: [{x: mx, y: knot.cy + KNOT_R}, {x: mx, y: topRect.y}], arrow: false});
  const busL = leftW + BUS_GAP / 2, busR = topX + topW + BUS_GAP / 2;
  left.forEach((row, i) => {
    const cy = (H * (i + 0.5)) / left.length;
    let px = 0, prev: Placed | undefined;
    row.forEach((it, k) => {
      const p: Placed = {x: px, y: cy - it.lines.h / 2, w: lw[k], h: it.lines.h, role: it.role, label: it.label, lines: it.lines};
      nodes.push(p);
      if (prev) edges.push({points: [{x: prev.x + prev.w, y: cy}, {x: p.x, y: cy}], arrow: true});
      prev = p; px += lw[k] + COL_GAP;
    });
    const end = prev as Placed;
    edges.push({points: [{x: end.x + end.w, y: cy}, {x: busL, y: cy}, {x: busL, y: yk}, {x: topX, y: yk}].filter((q, j, a) => j === 0 || q.x !== a[j - 1].x || q.y !== a[j - 1].y), arrow: true});
  });
  right.forEach((row, i) => {
    const cy = (H * (i + 0.5)) / right.length;
    let px = topX + topW + BUS_GAP, prev: Placed | undefined;
    row.forEach((it, k) => {
      const p: Placed = {x: px, y: cy - it.lines.h / 2, w: rw[k], h: it.lines.h, role: it.role, label: it.label, lines: it.lines};
      nodes.push(p);
      if (prev) edges.push({points: [{x: prev.x + prev.w, y: cy}, {x: p.x, y: cy}], arrow: true});
      else edges.push({points: [{x: topX + topW, y: yk}, {x: busR, y: yk}, {x: busR, y: cy}, {x: p.x, y: cy}].filter((q, j, a) => j === 0 || q.x !== a[j - 1].x || q.y !== a[j - 1].y), arrow: true});
      prev = p; px += rw[k] + COL_GAP;
    });
  });
  return {w: totalW, h: H, nodes, edges, knot};
}
