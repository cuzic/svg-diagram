import {assertScope} from './scope-name.ts';
import type {FontFamily, Roles, TextTone} from './types/core.ts';
import {must} from './must.ts';
import type {VennSet, VennOpts, VennBand, LaidOutFlowShape} from './flow-types.ts';
import {TEXT_TONES, common, checkTones, nodeOf, g4} from './flow-layout-core.ts';
import type {TextSpec, Pt, AnchorFn, Texts} from './flow-layout-core.ts';

export function vennBand(sets: readonly VennSet[], opts: VennOpts = {}): VennBand {
  if (sets.length < 2 || sets.length > 3) throw new Error(`venn(): needs 2 or 3 sets (got ${sets.length})`);
  common('venn', sets.map(s => ({label: s.name, id: s.id})), opts.id);
  assertScope(opts.scope, 'venn()');
  checkTones('venn', sets, TEXT_TONES);
  for (const s of sets) {
    if (!s.items) continue;
    if (s.items.length === 0 || s.items.length > 4 || s.items.some(i => !i.trim())) throw new Error(`venn(): set "${s.name}" items must be 1 to 4 non-empty strings`);
  }
  const names = new Set(sets.map(s => s.name));
  if (names.size !== sets.length) throw new Error('venn(): set names must be unique');
  const seen = new Set<string>();
  for (const o of opts.overlaps ?? []) {
    const named = new Set(o.sets);
    if (named.size < 2 || named.size !== o.sets.length || o.sets.some(n => !names.has(n))) throw new Error(`venn(): overlap "${o.label}" must name 2 or more different sets of this venn`);
    const key = [...named].sort().join('\u0000');
    if (seen.has(key)) throw new Error(`venn(): two overlaps name the same sets (${o.sets.join(', ')})`);
    seen.add(key);
    if (!o.label?.trim()) throw new Error('venn(): an overlap needs a non-empty label');
    if (opts.centre && named.size === sets.length) throw new Error(`venn(): centre and overlap "${o.label}" both label the part every set shares; keep one`);
  }
  return {...opts, type: 'venn', sets: [...sets], overlaps: [...(opts.overlaps ?? [])]};
}
/** `rings` may be a count (1-6) of plain rings when the rings are cut into `sectors` (a bullseye whose rings have no names). */

const bullet = (item: string) => `・${item}`;

export function vennTexts(b: VennBand, roles: Roles): [string, number, number, FontFamily][] {
  const bold = (t: string | undefined): TextSpec[] => t ? [[t, roles.note, 700]] : [];
  const plain = (t: string | undefined): TextSpec[] => t ? [[t, roles.note, 400]] : [];
  const specs = [...b.sets.flatMap(s => [...bold(s.label ?? s.name), ...(s.items ?? []).flatMap(i => plain(bullet(i)))]), ...b.overlaps.flatMap(o => bold(o.label)), ...bold(b.centre), ...plain(typeof b.universe === 'string' ? b.universe : undefined)];
  return specs.map(([text, size, weight]) => [text, size, weight, 'sans']);
}

export function layoutVenn(b: VennBand, out: LaidOutFlowShape, t: Texts, anchor: AnchorFn): void {
  const w = out.w, three = b.sets.length === 3, uni = !!b.universe;
  const r = three ? Math.min(w * .21, 170) : Math.min(w * .23, 190);
  const above = three ? 1.28 * r : r, below = three ? 1.52 * r : r; // how far the circles reach above / below the centre
  const padTop = uni ? 40 : 8, padBottom = uni ? 20 : 8;
  out.h = padTop + above + below + padBottom;
  const cx = out.x + w / 2, cy = out.y + padTop + above;
  const pos = (three ? [[cx - r * .55, cy - r * .28], [cx + r * .55, cy - r * .28], [cx, cy + r * .52]] : [[cx - r * .58, cy], [cx + r * .58, cy]]).map(p => p.map(g4) as Pt);
  const mid: Pt = [pos.reduce((a, p) => a + p[0], 0) / pos.length, pos.reduce((a, p) => a + p[1], 0) / pos.length];
  if (uni) {
    const fx = g4(out.x + 4), fy = g4(out.y + 4);
    out.primitives.push({k: 'rect', x: fx, y: fy, w: g4(out.x + w - 4) - fx, h: g4(out.y + out.h - 4) - fy, tone: 'muted'});
    if (typeof b.universe === 'string') t.place(t.wrap(b.universe, w - 32, 400), out.x + 16, out.y + 10, 'muted', 'start');
  }
  const DASH = ['', '7,5', '2,4'], TONES: TextTone[] = ['accent', 'danger', 'muted'];
  const centred = (text: string, [px, py]: Pt, maxW: number) => { const k = t.wrap(text, maxW); t.place(k, px, py - k.h / 2); };
  b.sets.forEach((s, i) => {
    const [px, py] = must(pos[i]), dx = px - mid[0], dy = py - mid[1], d = Math.hypot(dx, dy) || 1, k = three ? .5 : .42;
    out.primitives.push({k: 'circle', cx: px, cy: py, r, tone: s.tone ?? must(TONES[i]), opacity: .22, ...(DASH[i] ? {dash: DASH[i]} : {}), ...nodeOf(s)});
    anchor(s.id, {x: px - r, y: py - r, w: 2 * r, h: 2 * r});
    const at: Pt = [px + dx / d * k * r, py + dy / d * k * r]; // in the part only this set covers
    if (!s.items?.length) { centred(s.label ?? s.name, at, .8 * r); return; }
    // title (bold) above a short bullet list (left-aligned), the block centred on that spot
    const title = t.wrap(s.label ?? s.name, .8 * r), rows = s.items.map(item => t.wrap(bullet(item), .8 * r, 400));
    const gap = 4, H = title.h + gap + rows.reduce((a, q) => a + q.h, 0), listW = Math.max(...rows.map(q => q.w));
    const top = at[1] - H / 2, left = at[0] - listW / 2;
    const boxes: [number, number, number, number][] = [[at[0] - title.w / 2, top, at[0] + title.w / 2, top + title.h]];
    t.place(title, at[0], top);
    let y = top + title.h + gap;
    for (const q of rows) { t.place(q, left, y, 'text', 'start'); boxes.push([left, y, left + q.w, y + q.h]); y += q.h; }
    const dist = (x: number, yy: number, c: Pt) => Math.hypot(x - c[0], yy - c[1]);
    const fits = boxes.every(([x0, y0, x1, y1]) => [[x0, y0], [x1, y0], [x0, y1], [x1, y1]].every(([x, yy]) => dist(x!, yy!, [px, py]) <= r - 2 && pos.every((o, j) => j === i || dist(x!, yy!, o) >= r + 2)));
    if (!fits) (out.misfits ??= []).push(s.name);
  });
  for (const o of b.overlaps) {
    const idx = o.sets.map(name => b.sets.findIndex(s => s.name === name));
    if (idx.length === b.sets.length) { centred(o.label, mid, (three ? .55 : .7) * r); continue; }
    // a pair of three: the middle of the part only these two share, on the side away from the third circle
    const [p, q] = [must(pos[must(idx[0])]), must(pos[must(idx[1])])], third = must(pos[must([0, 1, 2].find(j => !idx.includes(j)))]);
    const m: Pt = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2], D = Math.hypot(m[0] - third[0], m[1] - third[1]);
    const half = Math.sqrt(r * r - (Math.hypot(p[0] - q[0], p[1] - q[1]) / 2) ** 2), reach = (r + D + half) / 2;
    centred(o.label, [third[0] + (m[0] - third[0]) / D * reach, third[1] + (m[1] - third[1]) / D * reach], .5 * r);
  }
  if (b.centre) centred(b.centre, mid, (three ? .55 : .7) * r);
}
