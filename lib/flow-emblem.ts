import {assertScope} from './scope-name.ts';
import {TONES} from './tokens.ts';
import {EMBLEM_FLEX, EMBLEM_SHAPES, EMBLEM_TEXT, emblemHeight, emblemMaxHeight, emblemOutline} from './emblem-shapes.ts';
import type {EmblemShape} from './emblem-shapes.ts';
import type {EmphasisTone, FontFamily, Roles, TextTone} from './types/core.ts';
import {must} from './must.ts';
import type {EmblemItem, EmblemOpts, EmblemBand, LaidOutFlowShape} from './flow-types.ts';
import {BOX_TONES, common, focusItems, onItem, checkTones, nodeOf, g4} from './flow-layout-core.ts';
import type {TextSpec, AnchorFn, Texts} from './flow-layout-core.ts';

const EMBLEM_SHAPE_SET: ReadonlySet<string> = new Set<string>(EMBLEM_SHAPES);
export function emblemBand(items: readonly EmblemItem[], opts: EmblemOpts = {}): EmblemBand {
  common('emblem', items, opts.id);
  assertScope(opts.scope, 'emblem()');
  checkTones('emblem', items, BOX_TONES);
  // the names this took before they were renamed: say so rather than ignore them (an ignored `kind` would silently draw circles)
  for (const [x, what] of [[opts, 'option'], ...items.map((i, n) => [i, `item ${n + 1}`] as const)] as const) {
    if ('kind' in x) throw new Error(`emblem(): \`kind\` is now \`shape\` (${what})`);
    if ('size' in x) throw new Error(`emblem(): \`size\` is now \`minSize\` (${what})`);
  }
  for (const k of [opts.shape, ...items.map(i => i.shape)]) if (k !== undefined && !EMBLEM_SHAPE_SET.has(k)) throw new Error(`emblem(): unknown shape "${String(k)}" (${EMBLEM_SHAPES.join(' | ')})`);
  if (opts.gap !== undefined && !(opts.gap >= 0)) throw new Error('emblem(): gap must be >= 0');
  if (opts.minSize !== undefined && !(opts.minSize >= 64 && opts.minSize <= EMBLEM_MAX)) throw new Error(`emblem(): minSize must be 64..${EMBLEM_MAX}`);
  const {focus, ...rest} = opts;
  return {...rest, type: 'emblem', items: focusItems('emblem', items, focus), shape: opts.shape ?? 'circle', gap: opts.gap ?? 16};
}

/** Porter's value chain (価値連鎖): support activities as bars over the primary activities as chevrons, and the margin as an arrow at the right. */

export function emblemTexts(b: EmblemBand, roles: Roles): [string, number, number, FontFamily][] {
  const bold = (t: string | undefined): TextSpec[] => t ? [[t, roles.note, 700]] : [];
  const plain = (t: string | undefined): TextSpec[] => t ? [[t, roles.note, 400]] : [];
  const specs = b.items.flatMap(i => [...bold(i.label), ...plain(i.sub)]);
  return specs.map(([text, size, weight]) => [text, size, weight, 'sans']);
}

const EMBLEM_MAX = 320, EMBLEM_WORD_MAX = 240;
const wordKind = (c: string | undefined): 'kana' | 'latin' | null => c === undefined ? null : /[ァ-ヺー-ヾｦ-ﾟ]/.test(c) ? 'kana' : /[A-Za-z0-9Ａ-Ｚａ-ｚ０-９]/.test(c) ? 'latin' : null; // katakana (full and half width, and ー), alphanumerics (half and full width); not ・ (U+30FB): it separates words
/** Whether wrapping `text` into `lines` cuts a katakana (or alphanumeric) word: the two letters either side of a break touch in the source (no space, newline or ・ between them). */
function splitsWord(text: string, lines: readonly string[]): boolean {
  let at = 0, last: string | undefined;
  for (const line of lines) {
    const rest = text.slice(at), skipped = rest.length - rest.trimStart().length; // the source's own spaces / newlines before this line
    const kind = wordKind(last);
    if (last !== undefined && skipped === 0 && kind !== null && kind === wordKind(line[0])) return true;
    at += skipped;
    if (!text.startsWith(line, at)) return false; // the wrapper changed the text (it does not, today): say nothing rather than guess
    at += line.length;
    last = line.at(-1);
  }
  return false;
}

/** The label is written in the tone's own text colour, as a box does (accent / muted / danger; `new` and `changed` keep the normal text, so `accent` and `new` differ by it). */
const labelTone = (tone: EmphasisTone): TextTone => { const t = TONES[tone].text; return t === 'accent' || t === 'muted' || t === 'danger' ? t : 'text'; };

export function layoutEmblem(b: EmblemBand, out: LaidOutFlowShape, t: Texts, anchor: AnchorFn): void {
  const shapeOf = (i: EmblemItem): EmblemShape => i.shape ?? b.shape;
  const gap = g4(b.gap), widest = Math.min(EMBLEM_MAX, Math.floor(out.w / 8) * 8), least = Math.ceil((b.minSize ?? 96) / 8) * 8;
  if (least > widest) throw new Error(`emblem(): minSize ${b.minSize ?? 96} is wider than the band (${Math.round(out.w)}px) — lower \`minSize\` or widen the band`);
  const blocks = (d: number) => b.items.map(i => {
    const shape = shapeOf(i), g = EMBLEM_TEXT[shape], label = t.wrap(i.label, g.w * d), sub = i.sub ? t.wrap(i.sub, g.w * d, 400) : undefined;
    const textH = label.h + (sub?.h ?? 0), h = emblemHeight(shape, d, textH); // a shape in EMBLEM_FLEX grows taller for its lines; the others keep their height
    const fits = Math.max(label.w, sub?.w ?? 0) <= g.w * d + .5 && (EMBLEM_FLEX.has(shape) ? h <= emblemMaxHeight(shape, d) : textH <= g.h * d);
    return {label, sub, fits, h, whole: !splitsWord(i.label, label.lines) && !(sub && i.sub && splitsWord(i.sub, sub.lines))};
  });
  // The least D where everything fits and every katakana / alphanumeric word stays whole (up to EMBLEM_WORD_MAX, or 144px past a `minSize` that is already near it: the search must have room to run); a label that cannot be kept
  // whole even there (a very long word) is let off, so it does not spoil the others. Else the least D that fits, words cut.
  const wholeCap = Math.min(widest, Math.max(EMBLEM_WORD_MAX, least + EMBLEM_WORD_MAX - 96)), plans = new Map<number, ReturnType<typeof blocks>>();
  const planAt = (d: number) => { let p = plans.get(d); if (!p) plans.set(d, p = blocks(d)); return p; };
  // let off only a label that is whole at NO size from `least` to `wholeCap` (whether a long word is cut can depend on where the wrap happens to fall, so it is not monotone in D)
  const letOff = b.items.map((_i, n) => { for (let d = least; d <= wholeCap; d += 8) if (must(planAt(d)[n]).whole) return false; return true; });
  const solve = (whole: boolean, limit: number) => { for (let d = least; d <= limit; d += 8) { const plan = planAt(d); if (plan.every((p, n) => p.fits && (!whole || p.whole || letOff[n]))) return {d, plan}; } return undefined; };
  const found = solve(true, wholeCap) ?? solve(false, widest);
  if (!found) {
    const bad = must(b.items.find((_i, n) => !must(blocks(widest)[n]).fits)), shape = shapeOf(bad), flex = EMBLEM_FLEX.has(shape);
    // a shape in EMBLEM_FLEX grows taller, not wider, so a square (which holds fewer lines) is no way out for it
    const ways = flex ? 'shorten it' : `shorten it, move words to \`sub\`${shape === 'square' ? '' : ", or use shape: 'square'"}`;
    throw new Error(`emblem(): "${bad.label}"${bad.sub ? ` / "${bad.sub}"` : ''} does not fit in a ${shape} up to ${widest}px${widest < EMBLEM_MAX ? ' (the width of the band)' : ''} — ${ways}${widest < EMBLEM_MAX ? ', or widen the band' : ''}`);
  }
  const {d, plan} = found;
  const perRow = Math.max(1, Math.floor((out.w + gap) / (d + gap))), rows = Math.ceil(b.items.length / perRow);
  const rowH = Math.max(...plan.map(p => p.h));
  out.h = rows * rowH + (rows - 1) * gap;
  b.items.forEach((item, n) => {
    const row = Math.floor(n / perRow), inRow = Math.min(perRow, b.items.length - row * perRow), col = n - row * perRow;
    const rowW = inRow * d + (inRow - 1) * gap, shape = shapeOf(item);
    const k = must(plan[n]), h = k.h, left = g4(out.x + (out.w - rowW) / 2 + col * (d + gap)), top = g4(out.y + row * (rowH + gap) + (rowH - h) / 2);
    const o = emblemOutline(shape, left, top, d, h), tone = item.tone ?? 'plain';
    if (o.points) out.primitives.push({k: 'polygon', points: o.points, tone, ...nodeOf(item)});
    else if (o.path) out.primitives.push({k: 'path', d: o.path, tone: 'text', fill: tone, box: o.box, ...nodeOf(item)});
    else out.primitives.push({k: 'circle', cx: left + d / 2, cy: top + d / 2, r: d / 2, tone: 'text', fill: tone, ...nodeOf(item)});
    anchor(item.id, o.anchor);
    if (item.id) (out.bounds ??= []).push({id: item.id, x: left, y: top, w: d, h: o.h});
    const blockH = k.label.h + (k.sub?.h ?? 0), cx = left + d / 2, cy = top + o.textCy;
    t.place(k.label, cx, cy - blockH / 2, onItem(tone, labelTone(tone)));
    if (k.sub) t.place(k.sub, cx, cy - blockH / 2 + k.label.h, onItem(tone, 'muted'));
  });
}
