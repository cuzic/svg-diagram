// ADR 0074 D4 / D5: slot values belong to the render, never to the worksheet layout.
import {splitAtoms, textWidth} from '../atoms.ts';
import {MIN_FONT_SIZE} from '../tokens.ts';
import type {ComicDialogue, ComicFinding, ComicLaidSlot, ComicSlotDef, ComicWorksheet, LaidOutComic, Values} from '../types/comic.ts';
import type {FontWeight, MeasureRequest, WidthOf} from '../types/core.ts';
import {FONT, f1} from './constants.ts';
import {slotMax} from './slot-check.ts';
import {comicAtomWidth, isFullWidth} from './width.ts';

export type ValueTable = Readonly<Partial<Values>>;

const graphemes = new Intl.Segmenter('ja', {granularity: 'grapheme'});
// biome-ignore lint/suspicious/noControlCharactersInRegex: Match the control character ranges of ONE_LINE in schema-files.ts.
const ONE_LINE = /^(?=[\s\S]*\S)[^\u0000-\u001f\u007f-\u009f]*$/;
// biome-ignore lint/suspicious/noControlCharactersInRegex: Reject characters that XML cannot represent.
const XML_DISALLOWED = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\ud800-\udfff\ufffe\uffff]/gu;
const noMeasure: WidthOf = () => { throw new Error('renderComicBand: 半角の原子を描くには幅の測定結果を渡してください'); };

export function slotValue(slot: ComicLaidSlot, values: ValueTable): {text: string; weight: FontWeight} | undefined {
  if (slot.defined === false || !Object.hasOwn(values, slot.id)) return undefined;
  const value = values[slot.id];
  if (value === undefined) return undefined;
  return {
    text: (value ?? slot.fallback).replace(XML_DISALLOWED, '�'),
    weight: value === null ? 400 : 700,
  };
}

const valueWidth = ({text, weight}: {text: string; weight: FontWeight}, size: number, widthOf: WidthOf): number =>
  textWidth((atom, size) => comicAtomWidth(atom, widthOf, size, weight), text, size, weight);

export function slotFontSize(slot: ComicLaidSlot, value: {text: string; weight: FontWeight}, widthOf = noMeasure, font: number = FONT): number {
  const w18 = valueWidth(value, font, widthOf);
  if (w18 <= slot.w) return font;
  if (valueWidth(value, MIN_FONT_SIZE, widthOf) > slot.w) return MIN_FONT_SIZE;
  return Math.max(MIN_FONT_SIZE, f1(font * slot.w / w18));
}

/** Both sizes are requested up front so rendering and verification can be synchronous. */
export function* valueAtoms(laid: {fontSize?: number; bubbles: readonly {slots: readonly ComicLaidSlot[]}[]}, values: ValueTable): Iterable<Required<MeasureRequest>> {
  for (const {slots} of laid.bubbles) for (const slot of slots) {
    const value = slotValue(slot, values);
    if (!value) continue;
    for (const text of splitAtoms(value.text)) {
      if (isFullWidth(text)) continue;
      for (const size of [laid.fontSize ?? FONT, MIN_FONT_SIZE]) yield {text, size, weight: value.weight, font: 'sans'};
    }
  }
}

function invalidReason(value: string, def: ComicSlotDef): string | undefined {
  if (!ONE_LINE.test(value)) return '空白だけの値や制御文字を避け、空でない 1 行の文字を入力してください';
  const max = slotMax(def);
  if (max !== undefined && [...graphemes.segment(value)].length > max) return `${max} 字以内にしてください`;
  if (def.strict && !def.choices?.includes(value)) return '穴に指定された候補から選んでください';
  return undefined;
}

export function valueFindings(sheet: ComicWorksheet, laid: LaidOutComic, values: ValueTable, widthOf = noMeasure): ComicFinding[] {
  return dialogueValueFindings(sheet.panels.flatMap(p => p.dialogue), laid, values, widthOf);
}

/** The value checks over any list of dialogue (chat() has no panels) and the laid-out bubbles that hold the blanks. */
export function dialogueValueFindings(dialogue: readonly ComicDialogue[], laid: {bubbles: readonly {slots: readonly ComicLaidSlot[]}[]}, values: ValueTable, widthOf = noMeasure): ComicFinding[] {
  const defs = new Map<string, ComicSlotDef>();
  for (const d of dialogue) {
    for (const [id, def] of Object.entries(d.slots ?? {})) if (!defs.has(id)) defs.set(id, def);
  }
  const findings: ComicFinding[] = [];
  for (const [where, value] of Object.entries(values)) {
    const def = defs.get(where);
    if (!def) findings.push({rule: 'comic-values-unknown', severity: 'advice', where, message: `穴 "${where}" の定義がありません。values には定義済みの穴の id を指定してください`});
    else if (typeof value === 'string') {
      const reason = invalidReason(value, def);
      if (reason) findings.push({rule: 'comic-value-invalid', severity: 'problem', where, message: `穴 "${where}" の値が無効です。${reason}`});
    }
  }
  for (const {slots} of laid.bubbles) for (const slot of slots) {
    const value = slotValue(slot, values);
    if (value && valueWidth(value, MIN_FONT_SIZE, widthOf) > slot.w) {
      findings.push({rule: 'slot-overflow', severity: 'problem', where: slot.id, message: `穴 "${slot.id}" の文字が ${MIN_FONT_SIZE}px でも収まりません。短い文字にしてください`});
    }
  }
  return findings;
}
