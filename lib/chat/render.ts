// Browser chat rendering (ADR 0074 D7): place the chat with the diagram pipeline, then fill the blanks of that SVG with the values, as renderComic does.
// The blanks are the same size and drawn the same in both, so a value filled in a comic shows identically in its chat.
import {isLaidOutChat} from '../bands/chat.ts';
import {chat} from '../dsl/chat.ts';
import {diagram} from '../dsl/diagram.ts';
import {replaceComicFragment} from '../comic/render.ts';
import {dialogueValueFindings, valueAtoms} from '../comic/slot-values.ts';
import type {WebMeasurer, WebRender} from '../web.ts';
import {renderInBrowser} from '../web.ts';
import type {ChatInput, ChatOpts, LaidOutChat} from '../types/chat.ts';
import type {CharacterManifest, ComicFinding, Values} from '../types/comic.ts';
import type {Measured, Rect, WidthOf} from '../types/core.ts';
import {CHAT_W} from './constants.ts';
import {renderChatBand} from './emit.ts';
import {qualify, scopeOf} from '../scope-name.ts';

export type ChatRender = WebRender & {
  findings: ComicFinding[];
  /** The blanks' rectangles by id, in viewBox coordinates (the same slots of a comic have the same sizes). */
  geometry: {bubbles: Record<string, Rect>; slots: Record<string, Rect>};
};

export async function renderChat(sheet: ChatInput, opts: {
  measure: WebMeasurer;
  values?: Values;
  characters?: Record<string, CharacterManifest>;
  self?: ChatOpts['self'];
  separators?: boolean;
  input?: ChatOpts['input'];
  nodeIds?: boolean;
}): Promise<ChatRender> {
  if (typeof opts?.measure !== 'function') throw new Error('renderChat: opts.measure に文字幅の測定関数を渡してください');
  const {measure, nodeIds} = opts;
  const values = {...opts.values};
  const band = chat(sheet, {
    ...(opts.characters === undefined ? {} : {characters: opts.characters}), ...(opts.self === undefined ? {} : {self: opts.self}),
    ...(opts.separators === undefined ? {} : {separators: opts.separators}), ...(opts.input === undefined ? {} : {input: opts.input}),
  });
  const pad = 20;
  const base = await renderInBrowser(diagram({theme: 'blue', title: band.sheet.title, legend: false, width: CHAT_W + 2 * pad, pad}).add(band),
    {measure, ...(nodeIds === undefined ? {} : {nodeIds})});
  const laid = base.laidOut.laidOut.find(isLaidOutChat);
  if (!laid) throw new Error('renderChat: 配置したチャットの帯が見つかりません。台詞を確認してください');
  const emitted: LaidOutChat = nodeIds ? {...laid, nodeIds: true} : laid;

  const memo = new Map<string, Promise<Measured>>();
  const key = (text: string, size: number, weight: number, font: string): string => JSON.stringify([text, size, weight, font]);
  for (const req of valueAtoms(laid, values)) {
    const k = key(req.text, req.size, req.weight, req.font);
    if (!memo.has(k)) memo.set(k, Promise.resolve().then(() => measure(req)));
  }
  const measured = new Map(await Promise.all([...memo].map(async ([k, answer]) => [k, await answer] as const)));
  const widthOf: WidthOf = (text, size, weight, font) => {
    const answer = measured.get(key(text, size, weight, font));
    if (!answer) throw new Error(`renderChat: "${text}" (${size}px) の幅がありません。測定関数を確認してください`);
    return answer.w;
  };
  const svg = replaceComicFragment(base.svg, renderChatBand(emitted), renderChatBand(emitted, values, widthOf));
  const scope = scopeOf(laid), name = (id: string) => qualify(scope, id);
  const rect = ({x, y, w, h}: Rect): Rect => ({x, y, w, h});
  return {
    ...base,
    svg,
    findings: dialogueValueFindings(band.sheet.dialogue, laid, values, widthOf),
    geometry: {
      bubbles: Object.fromEntries(laid.bubbles.map(b => [name(b.id), rect(b)])),
      slots: Object.fromEntries(laid.bubbles.flatMap(b => b.slots.map(s => [name(s.id), rect(s)] as const))),
    },
  };
}
