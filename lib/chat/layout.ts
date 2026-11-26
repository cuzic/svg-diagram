// The layout of a chat() band (ADR 0074 D7): the dialogue stacked from the top, the `self` speaker on the right, the others on the left with a round face and a name.
// A pure function of the data and a width function: the values of the blanks do not come in (they are drawn on top, as in comic()).
import {textWidth} from '../atoms.ts';
import {ceil4} from '../connect-rules.ts';
import {snap4} from '../emit-common.ts';
import {FONT, f1, metricsOf} from '../comic/constants.ts';
import {defaultHue} from '../comic/face.ts';
import {reserveDialogue} from '../comic/reserve.ts';
import {checkDialogueSlots, slotInfo} from '../comic/slot-check.ts';
import {fillTemplate, parseTemplate} from '../comic/template.ts';
import {comicAtomWidth} from '../comic/width.ts';
import type {ChatBand, ChatLaidAvatar, ChatLaidBubble, ChatLaidInput, LaidOutChat} from '../types/chat.ts';
import type {ComicFinding, ComicLaidSlot, ComicRule, ComicRun, ComicText} from '../types/comic.ts';
import type {Anchor, WidthOf} from '../types/core.ts';
import {chatDims, AVATAR_D, AVATAR_GAP, BUBBLE_R, CHAT_MARGIN, CHAT_W, GAP_RUN, GAP_SAME, GAP_SEPARATOR, INPUT_FONT, INPUT_GAP, INPUT_H, SEND_R} from './constants.ts';

export const DEFAULT_SELF = 'me';
/** The corner radius of a bubble of this height. */
export const bubbleRadius = (h: number): number => Math.min(BUBBLE_R, h / 2);

const INPUT_PAD = 16;

export function layoutChat(band: ChatBand, x: number, y: number, w: number, widthOf: WidthOf): LaidOutChat {
  const sheet = band.sheet;
  const self = band.self ?? DEFAULT_SELF;
  const font = band.fontSize ?? FONT, met = metricsOf(font), {lineH, padX, padY} = met;
  const {w: bandW, column, inner} = chatDims(band.width ?? CHAT_W);
  // the inner width of a bubble is at most the column less the padding
  const innerCap = column - 2 * padX;
  const nameH = ceil4(met.slotFont + 6), bubbleHeight = (n: number): number => ceil4(n * lineH + 2 * padY);
  const bx = snap4(x + Math.max(0, w - bandW) / 2), by = y; // the band's left edge is on the 4px grid, wherever the diagram puts x (canvas: 'slide')
  const left = bx + CHAT_MARGIN, right = bx + bandW - CHAT_MARGIN, bubbleLeft = left + AVATAR_D + AVATAR_GAP;
  const findings: ComicFinding[] = [];
  const noSelf = band.self === undefined && Object.keys(sheet.cast).length > 0 && !Object.hasOwn(sheet.cast, DEFAULT_SELF);
  const add = (rule: ComicRule, where: string, message: string, severity: ComicFinding['severity'] = 'problem'): void => { findings.push({rule, severity, where, message}); };
  const atomWidth = (atom: string): number => comicAtomWidth(atom, widthOf, font);
  const bubbles: ChatLaidBubble[] = [], avatars: ChatLaidAvatar[] = [], anchors: Anchor[] = [], texts: ComicText[] = [], separators: LaidOutChat['separators'] = [];
  const seenSlots = new Set<string>(), anchoredSlots = new Set<string>();
  if (noSelf) add('chat-self-missing', 'chat', `cast has no "${DEFAULT_SELF}", so every message is on the left (pass chat(sheet, {self: '<cast key>'}) for the speaker on the right)`);
  let cy = by + CHAT_MARGIN, prevWho: string | undefined, prevPanel: string | undefined, first = true;

  for (const m of sheet.dialogue) {
    const parts = parseTemplate(m.tpl, `chat(): ${m.id}`);
    const narration = m.kind === 'narration';
    const who = narration ? undefined : m.who;
    const member = who === undefined ? undefined : Object.hasOwn(sheet.cast, who) ? sheet.cast[who] : undefined;
    if (!narration && !member) add('chat-speaker-unknown', m.id, `${m.who ?? '(no who)'} is not in cast (${m.id}; add them to cast, or fix who)`);
    const mine = who !== undefined && who === self;
    const run = narration || who !== prevWho || first;

    // the gap above: a separator between two panels, a new run, or the same speaker going on
    if (!first) {
      if (band.separators && m.panel !== undefined && prevPanel !== undefined && m.panel !== prevPanel) {
        separators.push({y: cy + GAP_SEPARATOR / 2, x1: left, x2: right});
        cy += GAP_SEPARATOR;
      } else cy += run ? GAP_RUN : GAP_SAME;
    }
    first = false;

    const R = reserveDialogue(parts, sid => slotInfo(m, sid).max, atomWidth, font, {cap: inner, shrink: true, breakAt: innerCap});
    const widest = Math.max(0, ...R.lines.map(l => l.w));
    const bw = ceil4(widest + 2 * padX), bh = bubbleHeight(R.lines.length);
    const showFace = run && !narration && !mine && member !== undefined;
    const top = cy + (showFace ? nameH : 0);
    const bxl = narration ? snap4(bx + (bandW - bw) / 2) : mine ? right - bw : bubbleLeft;
    const rect = {x: bxl, y: top, w: bw, h: bh};

    if (showFace && who !== undefined && member) {
      const asset = member.asset;
      const ch = asset !== undefined && band.characters && Object.hasOwn(band.characters, asset) ? band.characters[asset] : undefined;
      if (asset !== undefined && !ch) add('comic-asset-missing', m.id, `${m.id} の素材 "${asset}" がありません。chat(sheet, {characters}) に素材を渡すか、cast の asset を外してください`);
      avatars.push({id: m.id, who, name: member.name, cx: left + AVATAR_D / 2, cy: cy + AVATAR_D / 2, r: AVATAR_D / 2, nameX: bubbleLeft, nameY: cy + nameH - 6,
        look: ch ? {kind: 'asset', asset: ch.id} : {kind: 'face', hue: member.face?.hue ?? defaultHue(sheet.cast, who), hair: member.face?.hair ?? 'short'}});
      texts.push({x: bubbleLeft, y: cy + nameH - 6, size: met.slotFont, text: member.name});
      const nameW = textWidth((atom, size) => comicAtomWidth(atom, widthOf, size), member.name, met.slotFont, 400);
      if (nameW > right - bubbleLeft) add('chat-name-wide', m.id, `the name "${member.name}" is ${f1(nameW)}px wide, but ${right - bubbleLeft}px are left beside the face (shorten the name, use a smaller fontSize, or widen the band with width)`);
    }

    checkDialogueSlots(m, m.id, parts, seenSlots, add);
    if (bw > column) add('comic-bubble-wide', m.id, `${m.id}: a word or a blank with its hiragana is wider than the column (${bw}px of ${column}px); shorten it`, 'advice');
    for (const n of R.notes) {
      if (n === 'orphan-line') add('comic-orphan-line', m.id, `${m.id}: the last line is two characters or fewer ("${R.lines.at(-1)?.atoms.map(a => a.text).join('') ?? ''}"); lengthen it or fit it on the line before`, 'advice');
      else if (n === 'follower-split') add('comic-follower-split', m.id, `${m.id}: a short run of hiragana after a blank is cut from it; reword so the blank and what follows stay on one line`, 'advice');
    }

    // the text block: lines from the left of the inner rectangle; a run of literal atoms is one <text>, a blank is a rectangle of its own
    const ih = R.lines.length * lineH, tx0 = bxl + padX, ty0 = top + (bh - ih) / 2;
    const runs: ComicRun[] = [], slots: ComicLaidSlot[] = [];
    R.lines.forEach((l, i) => {
      let ax = tx0, open = false;
      for (const a of l.atoms) {
        if (a.slot) {
          open = false;
          const {def, max} = slotInfo(m, a.slot);
          slots.push({id: a.slot, x: f1(ax), y: f1(ty0 + i * lineH + 2), w: a.w, h: lineH - 4, max, prompt: def?.prompt ?? '', fallback: def?.fallback ?? '…', ...(def === undefined ? {defined: false as const} : {})});
        } else if (open) (runs[runs.length - 1] as ComicRun).text += a.text;
        else { open = true; runs.push({x: f1(ax), y: f1(ty0 + i * lineH + met.baseline), text: a.text}); }
        ax += a.w;
      }
    });
    for (const r of runs) texts.push({x: r.x, y: r.y, size: font, text: r.text});
    for (const s of slots) texts.push({x: f1(s.x + s.w / 2), y: f1(s.y + s.h - 5), size: met.slotFont, text: s.prompt});
    bubbles.push({id: m.id, ...(m.panel === undefined ? {} : {panel: m.panel}), kind: m.kind, ...(m.who === undefined ? {} : {who: m.who}), mine, ...rect,
      lines: R.lines.map(l => l.atoms.map(a => a.text).join('')), runs, slots, ...(run && !narration ? {tail: mine ? 'right' as const : 'left' as const} : {}),
      title: fillTemplate(parts, () => '＿＿'), ...(slots.length ? {template: m.tpl} : {})});
    anchors.push({id: m.id, ...rect});
    for (const {id, x: sx, y: sy, w: sw, h: sh} of slots) if (!anchoredSlots.has(id)) { anchoredSlots.add(id); anchors.push({id, x: sx, y: sy, w: sw, h: sh}); }

    cy = Math.max(top + bh, showFace ? cy + AVATAR_D : 0);
    prevWho = who; prevPanel = m.panel;
  }

  let input: ChatLaidInput | undefined;
  if (band.input !== undefined) {
    cy += (first ? 0 : INPUT_GAP);
    const iw = bandW - 2 * CHAT_MARGIN;
    input = {x: left, y: cy, w: iw, h: INPUT_H, text: band.input, textX: left + INPUT_PAD, textY: f1(cy + INPUT_H / 2 + INPUT_FONT * 0.35), send: {cx: left + iw - 8 - SEND_R, cy: f1(cy + INPUT_H / 2), r: SEND_R}};
    texts.push({x: input.textX, y: input.textY, size: INPUT_FONT, text: band.input});
    cy += INPUT_H;
  }
  const H = cy + CHAT_MARGIN - by;
  return {type: 'chat', ...(band.id === undefined ? {} : {id: band.id}), ...(band.reveal === undefined ? {} : {reveal: band.reveal}), ...(band.until === undefined ? {} : {until: band.until}),
    x: bx, y: by, w: bandW, h: H, title: sheet.title, ...(font === FONT ? {} : {fontSize: font}), blank: sheet.blank ?? 'prompt', column: column, bubbles, avatars, separators, ...(input ? {input} : {}), anchors, texts, findings, characters: {...band.characters}};
}
