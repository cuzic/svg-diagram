import {textWidth} from './atoms.ts';
import type {Pt} from './graph-layout.ts';
import {measureNode, nodeRuns} from './tree.ts';
import type {FontFamily, Roles, WidthOf, WrapEnv} from './types/core.ts';
import type {CloudArrow, CloudBand, CloudBox, LaidOutCloud} from './types/diagrams.ts';
import type {BoxTone} from './types/text-bands.ts';
import {wrapText} from './wrap.ts';

// ---- evaporating cloud ------------------------------------------------------------------------------------------------------

const KEYS = ['a', 'b', 'c', 'd', 'd2'] as const;
const LETTER = {a: 'A', b: 'B', c: 'C', d: 'D', d2: "D'"} as const;
const ARROWS: CloudArrow[] = ['ab', 'ac', 'bd', 'cd', 'dd'];
const CLOUD_W = 220, CLOUD_GAP_MIN = 110, CLOUD_GAP_MAX = 170, ROW_GAP = 96, LIST_GAP = 28, NUM_GAP = 8;

const boxText = (k: typeof KEYS[number], v: CloudBox, sep = '：'): string => `${LETTER[k]}${sep}${typeof v === 'string' ? v : v.text}`;
const injectionText = (t: string): string => `→ ${t}`;
/** The number of each assumption (in the order written) and, per arrow, the chip text that lists its numbers. */
function numbering(band: CloudBand): {chip: Partial<Record<CloudArrow, string>>; n: number[]} {
  const by: Partial<Record<CloudArrow, number[]>> = {};
  (band.assumptions ?? []).forEach((a, i) => (by[a.on] ??= []).push(i + 1));
  return {chip: Object.fromEntries(Object.entries(by).map(([k, v]) => [k, v.join(',')])), n: (band.assumptions ?? []).map((_, i) => i + 1)};
}

export function cloudTexts(band: CloudBand, roles: Roles): [string, number, number, FontFamily][] {
  const out: [string, number, number, FontFamily][] = [];
  for (const k of KEYS) out.push([boxText(k, band[k], band.separator), roles.body, 700, 'sans']);
  const num = numbering(band);
  for (const t of Object.values(num.chip)) out.push([t, roles.note, 400, 'sans']);
  for (const i of num.n) out.push([`${i}.`, roles.note, 400, 'sans']);
  for (const a of band.assumptions ?? []) out.push([a.text, roles.note, 400, 'sans'], ...(a.injection ? [[injectionText(a.injection), roles.note, 400, 'sans'] as [string, number, number, FontFamily]] : []));
  if (band.conflictLabel) out.push([band.conflictLabel, roles.note, 400, 'sans']);
  return out;
}

export function layoutCloudBand(band: CloudBand, x: number, y: number, w: number, widthOf: WidthOf, roles: Roles, env: WrapEnv): LaidOutCloud {
  const S = roles.note, maxW = band.maxNodeW ?? CLOUD_W;
  const ids = new Set<string>();
  for (const k of KEYS) {
    const v = band[k], text = typeof v === 'string' ? v : v?.text;
    if (typeof text !== 'string' || !text.trim()) throw new Error(`cloud(): box ${LETTER[k]} needs a text`);
    const id = typeof v === 'string' ? undefined : v.id;
    if (id !== undefined) { if (ids.has(id)) throw new Error(`cloud(): duplicate box id "${id}"`); ids.add(id); }
  }
  for (const a of band.assumptions ?? []) {
    if (!ARROWS.includes(a.on)) throw new Error(`cloud(): an assumption sits on ${ARROWS.map(k => `'${k}'`).join(', ')} (got ${String(a.on)})`);
    if (typeof a.text !== 'string' || !a.text.trim()) throw new Error('cloud(): every assumption needs a text');
  }
  const colW = Math.min(maxW, Math.floor((w - 2 * CLOUD_GAP_MIN) / 3));
  if (colW < 120) throw new Error(`cloud(): the figure has ${Math.round(w)}px, too narrow for five boxes and the arrows between them (needs ${3 * 120 + 2 * CLOUD_GAP_MIN}px)`);
  const lines = Object.fromEntries(KEYS.map(k => [k, measureNode(boxText(k, band[k], band.separator), undefined, colW, widthOf, roles, env.wrap, env.keepWords, {keepWords: false})])) as Record<typeof KEYS[number], ReturnType<typeof measureNode>>;
  const boxW = Math.max(...KEYS.map(k => lines[k].w)), H = Math.max(lines.b.h, lines.c.h, lines.d.h, lines.d2.h), hA = lines.a.h;
  const gap = Math.min(CLOUD_GAP_MAX, Math.floor((w - 3 * boxW) / 2)), figW = 3 * boxW + 2 * gap, rowsH = 2 * H + ROW_GAP;
  const figH = Math.max(rowsH, hA), top = (figH - rowsH) / 2; // a tall A makes the figure taller; the rows stay centred beside it
  const x0 = x + (w - figW) / 2, x1 = x0 + boxW + gap, x2 = x1 + boxW + gap;
  const at = {
    a: {x: x0, y: y + figH / 2 - hA / 2, w: boxW, h: hA}, b: {x: x1, y: y + top, w: boxW, h: H}, c: {x: x1, y: y + top + H + ROW_GAP, w: boxW, h: H},
    d: {x: x2, y: y + top, w: boxW, h: H}, d2: {x: x2, y: y + top + H + ROW_GAP, w: boxW, h: H},
  };
  const defaultTone: Record<typeof KEYS[number], BoxTone> = {a: 'accent', b: 'plain', c: 'plain', d: 'plain', d2: 'plain'};
  const out: LaidOutCloud = {type: 'cloud', id: band.id, reveal: band.reveal, ...(band.until === undefined ? {} : {until: band.until}), x, y, w, h: figH, nodes: [], edges: [], chips: [], texts: [], anchors: [], labelBoxes: []};
  for (const k of KEYS) {
    const v = band[k], r = at[k];
    out.nodes.push({...r, key: k, tone: (typeof v === 'string' ? undefined : v.tone) ?? defaultTone[k], ...(typeof v !== 'string' && v.id ? {id: v.id} : {})});
    if (typeof v !== 'string' && v.id) out.anchors.push({id: v.id, ...r});
    out.texts.push(...nodeRuns(r, lines[k], roles));
    out.labelBoxes.push({label: boxText(k, v, band.separator), ...r});
  }

  // arrows: a need points at the objective, a want at its need ("in order to A we must B, in order to B we must D")
  const cyB = at.b.y + H / 2, cyC = at.c.y + H / 2, cyA = at.a.y + hA / 2, off = Math.min(12, hA / 2 - 8), midX = at.a.x + boxW + gap / 2;
  const edge = (arrow: CloudArrow, points: Pt[]) => out.edges.push({arrow, points});
  edge('ab', [{x: x1, y: cyB}, {x: midX, y: cyB}, {x: midX, y: cyA - off}, {x: x0 + boxW, y: cyA - off}]);
  edge('ac', [{x: x1, y: cyC}, {x: midX, y: cyC}, {x: midX, y: cyA + off}, {x: x0 + boxW, y: cyA + off}]);
  edge('bd', [{x: x2, y: cyB}, {x: x1 + boxW, y: cyB}]);
  edge('cd', [{x: x2, y: cyC}, {x: x1 + boxW, y: cyC}]);
  const cx = x2 + boxW / 2, y0 = y + top + H;
  edge('dd', [{x: cx, y: y0}, {x: cx, y: y0 + ROW_GAP * 0.3}, {x: cx + 10, y: y0 + ROW_GAP * 0.45}, {x: cx - 10, y: y0 + ROW_GAP * 0.55}, {x: cx, y: y0 + ROW_GAP * 0.7}, {x: cx, y: y0 + ROW_GAP}]);

  // the numbers of the assumptions, in a white chip on their arrow
  const num = numbering(band), chipH = S + 8;
  const chipAt: Record<CloudArrow, Pt> = {
    ab: {x: midX, y: (cyB + cyA - off) / 2}, ac: {x: midX, y: (cyC + cyA + off) / 2},
    bd: {x: (x1 + boxW + x2) / 2, y: cyB}, cd: {x: (x1 + boxW + x2) / 2, y: cyC}, dd: {x: 0, y: y0 + ROW_GAP / 2},
  };
  const chip = (arrow: CloudArrow, text: string, cxm: number, cym: number, conflict = false): void => {
    const cw = Math.ceil(textWidth(widthOf, text, S, 400)) + 12;
    out.chips.push({text, x: cxm - cw / 2, y: cym - chipH / 2, w: cw, h: chipH, tx: cxm, ty: cym - chipH / 2 + S + 2, size: S, arrow, ...(conflict ? {conflict: true} : {})});
  };
  const widthOfChip = (text: string): number => Math.ceil(textWidth(widthOf, text, S, 400)) + 12;
  for (const arrow of ARROWS) {
    const text = num.chip[arrow];
    if (!text) continue;
    // beside the zigzag: to its right, or to its left when the right would leave the figure
    if (arrow === 'dd') {
      const cw = widthOfChip(text), right = cx + 22 + cw / 2, left = right + cw / 2 > x + w;
      // a conflict label also sits on the left: the two chips stack (the label above, the numbers below)
      chip(arrow, text, left ? cx - 22 - cw / 2 : right, chipAt.dd.y + (left && band.conflictLabel ? chipH / 2 + 2 : 0));
    } else chip(arrow, text, chipAt[arrow].x, chipAt[arrow].y);
  }
  // the word on the conflict: a chip left of the zigzag, so verify keeps it clear of the boxes, the arrows and the other chips
  if (band.conflictLabel) { const cw = widthOfChip(band.conflictLabel); chip('dd', band.conflictLabel, cx - 22 - cw / 2, chipAt.dd.y - (num.chip.dd && cx + 22 + widthOfChip(num.chip.dd) > x + w ? chipH / 2 + 2 : 0), true); }

  // the list: each assumption by its number, its injection under it
  const list = band.assumptions ?? [];
  if (list.length) {
    const numW = Math.ceil(Math.max(...num.n.map(i => textWidth(widthOf, `${i}.`, S, 400)))) + NUM_GAP, inner = figW - numW, lh = Math.round(S * 1.4);
    const wrap = (t: string): string[] => wrapText(t, {maxWidth: inner, atomWidth: a => widthOf(a, S, 400, 'sans'), mode: env.wrap});
    let ty = y + figH + LIST_GAP;
    for (const [i, a] of list.entries()) {
      out.texts.push({text: `${i + 1}.`, x: x0, y: ty + S, size: S, bold: false, muted: false, anchor: 'start'});
      for (const [text, tone] of [[a.text, undefined], ...(a.injection ? [[injectionText(a.injection), 'accent' as const]] as const : [])] as const) {
        for (const line of wrap(text)) { out.texts.push({text: line, x: x0 + numW, y: ty + S, size: S, bold: false, muted: false, anchor: 'start', ...(tone ? {tone} : {})}); ty += lh; }
      }
      ty += 6;
    }
    out.h = ty - 6 - y;
  }
  return out;
}
