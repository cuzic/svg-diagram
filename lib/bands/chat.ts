import {band} from '../band-def.ts';
import type {BandDef, WithBandDef} from '../band-def.ts';
import {texts} from '../band-text-sizes.ts';
import {renderChatBand} from '../chat/emit.ts';
import {layoutChat} from '../chat/layout.ts';
import {chatMeasure} from '../chat/measure.ts';
import {chatRuleDocs, comicAcceptHint, comicAdvice, comicProblems, comicRuleDocs} from '../comic/findings.ts';
import {parseTemplate, slotIdsOf} from '../comic/template.ts';
import {chat as build} from '../dsl/chat.ts';
import {appendPlacedBand} from '../layout-placed.ts';
import type {ChatBand, ChatInput, ChatOpts, LaidOutChat} from '../types/chat.ts';
import {chatRects} from '../verify-chat-rects.ts';

const definition = {
  type: 'chat',
  textSizes: texts,
  internal: true,
  ids({sheet}) {
    const ids = new Set<string>();
    for (const m of sheet.dialogue) {
      ids.add(m.id);
      for (const slot of slotIdsOf(parseTemplate(m.tpl, `chat(): ${m.id}`))) ids.add(slot);
    }
    return [...ids];
  },
  layout(data, ctx, x, w) {
    const laid = layoutChat(data, x, ctx.originOf(data, ctx.y), w, ctx.widthOf);
    appendPlacedBand(data, laid, ctx, 'a chat takes an id that another anchor already has',
      'a chat message or blank takes an id that another anchor already has');
  },
  measure(data, {atoms}) {
    for (const [text, size, weight, font] of chatMeasure(data)) atoms(text, size, weight, font);
  },
  emit: laid => renderChatBand(laid),
  nameNodes: laid => ({...laid, nodeIds: true}),
  nodeIds: 'self',
  rectsQualified: true,
  rules: {...comicRuleDocs, ...chatRuleDocs},
  verify: {
    rects: chatRects,
    layoutFindings: comicAdvice,
    check: laid => comicProblems(laid, 'chat'),
    acceptHint: comicAcceptHint,
  },
} satisfies BandDef<ChatBand, LaidOutChat>;

/** Builds a chat band for renderBands(). */
export function chat<const Id extends string = never, const Sheet extends ChatInput = ChatInput>(
  sheet: Sheet, opts?: ChatOpts & {id?: Id},
): WithBandDef<ReturnType<typeof build<Id, Sheet>>, LaidOutChat> {
  const data = build<Id, Sheet>(sheet, opts);
  return band<typeof data, LaidOutChat>(definition, data);
}

/** @internal The placed chat among the placed bands. */
export const isLaidOutChat = (b: {type: string}): b is LaidOutChat => b.type === 'chat';

/** @internal Definition used by the full renderer. */
export const chatDefinition: BandDef<ChatBand, LaidOutChat> = definition;
