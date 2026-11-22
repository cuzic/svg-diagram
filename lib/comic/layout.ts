// The layout of a comic() band (ADR 0074 D1 / D2): panels on a grid, the people at fixed places in each, the bubbles over their heads. A pure
// function of the data and a width function: the values of the blanks do not come in (they are drawn on top, ADR 0074 D5).
import {BADGE, FONT, GUTTER, HEAD_FROM_BOTTOM, HEAD_KEEP, HEAD_R, LINE_H, MARGIN, PAD_X, PAD_Y, PANEL_W, PANEL_W_2X2, NARRATION_LEFT, SIDE_KEEP, SLOT_FONT, SLOT_MAX, STACK_GAP, STAGE_X, TAIL_CLEAR, TAIL_HALF, TAIL_MIN, TAIL_STOP, ZONE_TOP, bandWidth, f1} from './constants.ts';
import {ceil4} from '../connect-rules.ts';
import {snap4} from '../emit-common.ts';
import {rectOverlap} from '../verify-base.ts';
import {comicAtomWidth} from './width.ts';
import {fillTemplate, parseTemplate, slotIdsOf} from './template.ts';
import {balloonPath} from './balloon-path.ts';
import {characterOverhang, mapPoint} from './character.ts';
import {reserveDialogue} from './reserve.ts';
import type {Reserved} from './reserve.ts';
import {checkBubbleFace, checkTail, tailCrosses} from './check.ts';
import type {BubbleKind, ComicAspect, ComicAt, ComicBand, ComicFinding, ComicLaidBubble, ComicLaidHead, ComicLaidPanel, ComicLaidSlot, ComicLayoutName, ComicRule, ComicRun, ComicSlotDef, ComicText, ComicWorksheet, LaidOutComic} from '../types/comic.ts';
import type {Anchor, Rect, WidthOf} from '../types/core.ts';

/** The panels of each named layout: columns x rows. */
export const LAYOUT_GRID: Readonly<Record<ComicLayoutName, {cols: number; rows: number}>> = {'1x4': {cols: 1, rows: 4}, '2x2': {cols: 2, rows: 2}, '1x3': {cols: 1, rows: 3}, '1x2': {cols: 1, rows: 2}};
/** The default shape of a panel in a column of panels (ADR 0074 Q10; see the measurement in the ADR). */
export const DEFAULT_COLUMN_ASPECT: ComicAspect = '6:5';
const RATIO: Record<ComicAspect, number> = {'7:5': 5 / 7, '6:5': 5 / 6, '1:1': 1};

export const aspectOf = (layout: ComicLayoutName, aspect: ComicAspect | undefined): ComicAspect => aspect ?? (layout === '2x2' ? '1:1' : DEFAULT_COLUMN_ASPECT);
/** The size of one panel: 420 wide in a column (360 in a 2x2), the height from the aspect on the 4px grid. */
export function panelSize(layout: ComicLayoutName, aspect: ComicAspect | undefined): {w: number; h: number} {
  const w = LAYOUT_GRID[layout].cols === 2 ? PANEL_W_2X2 : PANEL_W;
  return {w, h: snap4(w * RATIO[aspectOf(layout, aspect)])};
}
/** The band over the heads that the bubbles stack in: from ZONE_TOP to HEAD_KEEP above the head circle, as distances from the panel's top. */
export const zoneOf = (panelH: number): {top: number; bottom: number} => ({top: ZONE_TOP, bottom: panelH - HEAD_FROM_BOTTOM - HEAD_R - HEAD_KEEP});
/** The most lines two stacked bubbles may have together: what the zone holds (4 at 7:5, 6 at 6:5). */
export const lineBudget = (panelH: number): number => { const z = zoneOf(panelH); return Math.floor((z.bottom - z.top - STACK_GAP - 2 * 2 * PAD_Y) / LINE_H); };
/** The height of a bubble of `n` lines. */
export const bubbleHeight = (n: number): number => ceil4(n * LINE_H + 2 * PAD_Y);
const MAX_BUBBLE_LINES = 3;

interface SlotInfo {max: number; def: ComicSlotDef | undefined}
export const slotMax = (def: ComicSlotDef | undefined): number | undefined => def?.max ?? (def?.choices?.length ? Math.max(...def.choices.map(c => [...c].length)) : undefined);

/** A fixed hue by cast position, stepping around the colour wheel by approximately the golden angle. */
const defaultHue = (cast: ComicWorksheet['cast'], who: string): number => (210 + 137 * Math.max(0, Object.keys(cast).indexOf(who))) % 360;

const headX = (at: ComicAt, w: number): number => at === 'left' ? STAGE_X : at === 'right' ? w - STAGE_X : Math.floor(w / 2 / 4) * 4;

export function layoutComic(band: ComicBand, x: number, y: number, w: number, widthOf: WidthOf): LaidOutComic {
  const sheet = band.sheet;
  const {cols, rows} = LAYOUT_GRID[sheet.layout];
  const aspect = aspectOf(sheet.layout, band.aspect);
  const {w: PW, h: PH} = panelSize(sheet.layout, band.aspect);
  const zone = zoneOf(PH), budget = lineBudget(PH);
  const W = bandWidth(cols, PW), H = 2 * MARGIN + rows * PH + (rows - 1) * GUTTER;
  const bx = x + snap4(Math.max(0, w - W) / 2), by = y;
  const findings: ComicFinding[] = [];
  const add = (rule: ComicRule, where: string, message: string, severity: ComicFinding['severity'] = 'problem'): void => { findings.push({rule, severity, where, message}); };
  const atomWidth = (atom: string): number => comicAtomWidth(atom, widthOf);
  if (sheet.panels.length !== cols * rows) add('comic-panel-count', 'comic', `layout ${sheet.layout} has ${cols * rows} panels, but panels has ${sheet.panels.length} (add or remove panels, or change layout)`);

  const panels: ComicLaidPanel[] = [], bubbles: ComicLaidBubble[] = [], anchors: Anchor[] = [], texts: ComicText[] = [];
  const seenSlots = new Set<string>();
  sheet.panels.forEach((p, pi) => {
    const px = bx + MARGIN + (pi % cols) * (PW + GUTTER), py = by + MARGIN + Math.floor(pi / cols) * (PH + GUTTER);
    const heads = new Map<string, ComicLaidHead>(), taken = new Set<ComicAt>();
    const overhangs: {id: string; bounds: Rect}[] = [];
    const headCy = py + PH - HEAD_FROM_BOTTOM;
    for (const s of p.stage) {
      if (taken.has(s.at)) add('comic-at-collision', p.id, `two people stand at ${s.at} in ${p.id} (use left / center / right once each)`);
      taken.add(s.at);
      if (heads.has(s.who)) continue;
      const cx = px + headX(s.at, PW);
      const cast = sheet.cast[s.who], asset = cast?.asset;
      const ch = asset !== undefined && band.characters && Object.hasOwn(band.characters, asset) ? band.characters[asset] : undefined;
      const head: ComicLaidHead = {
        id: `${p.id}.${s.who}`, who: s.who, name: cast?.name ?? s.who, expression: s.expression,
        look: {kind: 'face', hue: cast?.face?.hue ?? defaultHue(sheet.cast, s.who), hair: cast?.face?.hair ?? 'short'},
        cx, cy: headCy, r: HEAD_R, mouth: [cx, f1(headCy + HEAD_R * 0.42)],
      };
      if (asset !== undefined && !ch) add('comic-asset-missing', head.id, `${head.id} の素材 "${asset}" がありません。comic(sheet, {characters}) に素材を渡すか、cast の asset を外してください`);
      else if (ch && ch.expressions[s.expression] === undefined) add('comic-asset-missing', head.id, `${head.id} の素材 "${ch.id}" に表情 "${s.expression}" がありません。断片を足すか、別の表情を指定してください`);
      if (ch?.expressions[s.expression] !== undefined) {
        head.look = {kind: 'asset', asset: ch.id};
        head.mouth = mapPoint(ch, head, ch.anchors.mouth);
        if (ch.anchors.hand) head.hand = mapPoint(ch, head, ch.anchors.hand);
        const bounds = characterOverhang(ch, head);
        if (bounds) overhangs.push({id: head.id, bounds});
      }
      heads.set(s.who, head);
    }
    const label = sheet.numbering === false ? undefined : sheet.labels?.[pi] ?? String(pi + 1);
    panels.push({id: p.id, x: px, y: py, w: PW, h: PH, ...(label === undefined ? {} : {label}), tint: p.bg?.tint ?? 'plain', heads: [...heads.values()]});
    anchors.push({id: p.id, x: px, y: py, w: PW, h: PH});
    if (label !== undefined) texts.push({x: px - 8 + BADGE / 2, y: py - 8 + 17, size: SLOT_FONT, text: label});

    const placed: {x: number; y: number; w: number; h: number; lines: number}[] = [];
    const panelSlots = new Set<string>(), skipChecks = new Set<string>();
    let budgetReported = false;
    for (const dlg of p.dialogue) {
      const id = `${p.id}.${dlg.id}`;
      const parts = parseTemplate(dlg.tpl, `comic(): ${id}`);
      const info = (sid: string): SlotInfo => {
        const def = dlg.slots && Object.hasOwn(dlg.slots, sid) ? dlg.slots[sid] : undefined;
        return {max: slotMax(def) ?? 4, def};
      };
      const R = reserveDialogue(parts, sid => info(sid).max, atomWidth);
      const bw = ceil4(R.inner + 2 * PAD_X), bh = bubbleHeight(R.lines.length);
      const speaker = dlg.who === undefined ? undefined : heads.get(dlg.who);
      if (!speaker && dlg.kind !== 'narration') add('comic-speaker-unknown', id, `${dlg.who ?? '(no who)'} is not on the stage of ${p.id}${dlg.who !== undefined && !(dlg.who in sheet.cast) ? ' and not in cast' : ''} (add them to stage, or fix who)`);
      // the bubble's x: over the speaker's head, kept inside the panel; a narration sits in the corner
      const want = dlg.kind === 'narration' ? px + NARRATION_LEFT + bw / 2 : speaker ? speaker.cx : px + PW / 2;
      const left = snap4(Math.min(Math.max(want - bw / 2, px + SIDE_KEEP), px + PW - SIDE_KEEP - bw));
      // stacked under every earlier bubble it overlaps sideways, or that lies to its right (side by side only when the earlier ones are all to its left)
      const under = placed.filter(q => (q.x < left + bw + STACK_GAP && left < q.x + q.w + STACK_GAP) || left < q.x);
      const top = Math.max(py + zone.top, ...under.map(q => q.y + q.h + STACK_GAP));
      const rect = {x: left, y: top, w: bw, h: bh};
      placed.push({...rect, lines: R.lines.length});
      // the root causes first; the face and tail checks of a bubble that overflowed are its consequences, so they do not run (one mistake, one report)
      const pastZone = top + bh > py + zone.bottom;
      const overhang = pastZone ? undefined : overhangs.find(({bounds}) => rectOverlap(rect, bounds, 0));
      if (pastZone) add('comic-bubble-zone', id, `${id}: the stack ends ${top + bh - py}px from the top of the panel, but the band over the heads ends at ${zone.bottom}px (fewer or shorter lines: at most ${budget} lines in all)`);
      else if (overhang) add('comic-bubble-zone', id, `${id} が ${overhang.id} の素材の上部に重なります。台詞を短くするか、人物や素材の絵の位置を調整してください`);
      const stackLines = R.lines.length + under.reduce((n, q) => n + q.lines, 0);
      if (!budgetReported && (stackLines > budget || R.lines.length > MAX_BUBBLE_LINES)) {
        budgetReported = true;
        add('comic-text-budget', id, `${id}: ${R.lines.length > MAX_BUBBLE_LINES ? `${R.lines.length} lines in one bubble (at most ${MAX_BUBBLE_LINES})` : `${stackLines} lines are stacked in ${p.id} (at most ${budget})`}; shorten the lines (blanks count at their widest)`);
      }
      for (const n of R.notes) add(`comic-${n}` as ComicRule, id, wrapNote(n, id, R), 'advice');
      // blanks
      for (const sid of slotIdsOf(parts)) {
        const {def} = info(sid);
        panelSlots.add(sid);
        if (!def) add('comic-slot-undefined', id, `{${sid}} in ${id} has no definition in slots`);
        if (seenSlots.has(sid)) add('comic-slot-duplicate', id, `blank id ${sid} is used twice (a blank id is unique in the whole worksheet)`);
        seenSlots.add(sid);
        if (def) {
          const m = slotMax(def);
          if (m === undefined || !Number.isInteger(m) || m < 1 || m > SLOT_MAX) add('comic-slot-max', id, `max of ${sid} is ${m ?? 'not given'}: use a whole number from 1 to ${SLOT_MAX}`);
          else {
            if (def.fallback !== undefined && [...def.fallback].length > m) add('comic-slot-max', id, `fallback of ${sid} has ${[...def.fallback].length} characters, more than its max ${m}`);
            for (const c of def.choices ?? []) if ([...c].length > m) add('comic-slot-max', id, `choice "${c}" of ${sid} has ${[...c].length} characters, more than its max ${m}`);
          }
          const pl = [...(def.prompt ?? '')].length;
          if (pl < 2 || pl > 4) add('comic-slot-prompt', id, `prompt of ${sid} has ${pl} characters (use 2 to 4)`);
        }
      }
      for (const sid of Object.keys(dlg.slots ?? {})) if (!slotIdsOf(parts).includes(sid)) add('comic-slot-undefined', id, `slots has "${sid}", but tpl of ${id} has no {${sid}}`);
      // the text block: lines centred in the inner rectangle; a run of literal atoms is one <text>, a blank is a rectangle of its own
      const ih = R.lines.length * LINE_H, tx0 = left + (bw - R.inner) / 2, ty0 = top + (bh - ih) / 2;
      const runs: ComicRun[] = [], slots: ComicLaidSlot[] = [];
      R.lines.forEach((l, i) => {
        let ax = tx0 + (R.inner - l.w) / 2, open = false;
        for (const a of l.atoms) {
          if (a.slot) {
            open = false;
            const def = info(a.slot).def;
            slots.push({id: a.slot, x: f1(ax), y: f1(ty0 + i * LINE_H + 2), w: a.w, h: LINE_H - 4, max: info(a.slot).max, prompt: def?.prompt ?? '', fallback: def?.fallback ?? '…',
              ...(def === undefined ? {defined: false} : {})});
          } else if (open) (runs[runs.length - 1] as ComicRun).text += a.text;
          else { open = true; runs.push({x: f1(ax), y: f1(ty0 + i * LINE_H + 19), text: a.text}); }
          ax += a.w;
        }
      });
      for (const r of runs) texts.push({x: r.x, y: r.y, size: FONT, text: r.text});
      for (const s of slots) texts.push({x: f1(s.x + s.w / 2), y: f1(s.y + s.h - 5), size: SLOT_FONT, text: s.prompt});
      const bubble: ComicLaidBubble = {id, panel: p.id, kind: dlg.kind, ...(dlg.who === undefined ? {} : {who: dlg.who}), ...rect, lines: R.lines.map(l => l.atoms.map(a => a.text).join('')), runs, slots, title: fillTemplate(parts, () => '＿＿'),
        ...(slots.length ? {template: dlg.tpl} : {})};
      const tail = speaker && dlg.kind !== 'narration' ? tailOf(bubble, speaker) : undefined;
      if (tail) bubble.tail = tail;
      bubbles.push(bubble);
      anchors.push({id, ...rect});
      if (pastZone || overhang) skipChecks.add(id);
      else for (const h of heads.values()) checkBubbleFace(bubble, h, add);
    }
    // the tails, once every bubble of the panel is placed. A tail that runs behind another bubble of its own speaker is dropped (the bubble below
    // carries the tail: a speaker's two bubbles read as one); behind another speaker's bubble it is a mistake.
    const inPanel = bubbles.filter(b => b.panel === p.id);
    for (const b of inPanel) {
      if (!b.tail) continue;
      const hit = inPanel.filter(o => o !== b && tailCrosses(b.tail as NonNullable<ComicLaidBubble['tail']>, o));
      if (hit.some(o => o.who === b.who)) { delete b.tail; continue; }
      const speaker = b.who === undefined ? undefined : heads.get(b.who);
      if (skipChecks.has(b.id) || !speaker) continue;
      if (hit.length) add('comic-tail-crosses-bubble', b.id, `the tail of ${b.id} runs behind ${hit.map(o => o.id).join(', ')} (put the speakers' bubbles in an order that keeps their tails apart, or merge the lines of one speaker)`);
      checkTail(b, speaker, add);
    }
    if (panelSlots.size > 2) add('comic-slots-per-panel', p.id, `${p.id} has ${panelSlots.size} blanks (at most 2 in a panel: the reader fills them in one glance)`);
  });
  // Duplicate blanks already have a worksheet finding. Register the first occurrence so the sheet can still be drawn.
  const anchoredSlots = new Set<string>();
  for (const {slots} of bubbles) for (const {id, x, y, w, h} of slots) {
    if (anchoredSlots.has(id)) continue;
    anchoredSlots.add(id);
    anchors.push({id, x, y, w, h});
  }
  return {type: 'comic', ...(band.id === undefined ? {} : {id: band.id}), ...(band.reveal === undefined ? {} : {reveal: band.reveal}), ...(band.until === undefined ? {} : {until: band.until}),
    x: bx, y: by, w: W, h: H, title: sheet.title, layout: sheet.layout, aspect, blank: sheet.blank ?? 'prompt', panels, bubbles, anchors, texts, findings, characters: {...band.characters}};
}

const wrapNote = (n: 'orphan-line' | 'bubble-wide' | 'follower-split', id: string, r: Reserved): string => n === 'orphan-line' ? `${id}: the last line is two characters or fewer ("${r.lines.at(-1)?.atoms.map(a => a.text).join('') ?? ''}"); lengthen it or merge it into the line before`
  : n === 'bubble-wide' ? `${id}: the text is wider than 11 characters (${r.inner}px); shorten the blank or the hiragana after it`
  : `${id}: a short run of hiragana after a blank is cut from it; reword so the blank and what follows stay on one line`;

/** The tail: its tip is on the line from the bubble's centre to the speaker's mouth, stopping TAIL_STOP outside the head circle (never over the face); the outline (lib/comic/balloon-path.ts) works out where the wedge meets the body. */
export function tailOf(b: Rect & {kind: BubbleKind}, speaker: ComicLaidHead): ComicLaidBubble['tail'] {
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
  const dx = speaker.mouth[0] - cx, dy = speaker.mouth[1] - cy, len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len;
  const hx = speaker.cx - cx, hy = speaker.cy - cy, proj = hx * ux + hy * uy, perp = Math.hypot(hx - proj * ux, hy - proj * uy);
  const edge = Math.min(b.w / 2 / Math.abs(ux || 1e-9), b.h / 2 / Math.abs(uy || 1e-9));
  // the tip stops TAIL_STOP outside the head circle, the tail is at least TAIL_MIN long, and the tip never comes closer than TAIL_CLEAR to the circle
  const entry = proj - Math.sqrt(Math.max(speaker.r * speaker.r - perp * perp, 0));
  const reach = Math.min(Math.max(entry - TAIL_STOP, edge + TAIL_MIN), entry - TAIL_CLEAR);
  const tip: [number, number] = [f1(cx + ux * reach), f1(cy + uy * reach)];
  const base = balloonPath(b, b.kind, {tip, halfWidth: TAIL_HALF}).base;
  if (!base) return undefined;
  return {base, tip, from: [f1((base[0][0] + base[1][0]) / 2), f1((base[0][1] + base[1][1]) / 2)]};
}
