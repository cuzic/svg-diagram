// chat() (ADR 0074 D7): the dialogue of a comic worksheet (or a dialogue list with a cast) as a chat screen. The data holds no coordinates and no sizes.
import {COMIC_ID} from '../comic/template.ts';
import {CHAT_W, CHAT_W_MAX} from '../chat/constants.ts';
import {FONT_SIZE_MAX, FONT_SIZE_MIN} from '../comic/constants.ts';
import {loadCharacter} from '../comic/character.ts';
import type {Declares, HandleOf} from '../strict.ts';
import type {ChatBand, ChatInput, ChatMessage, ChatOpts, ChatSheet} from '../types/chat.ts';
import {revealOf, scopeOpt, withHandle} from './shared.ts';
import {comic, speechBubble} from './comic.ts';
export type {ChatBand, ChatInput, ChatMessage, ChatOpts, ChatSheet} from '../types/chat.ts';

/** The placeholder of a message box that is asked for with `input: true`. */
const CHAT_INPUT_DEFAULT = 'メッセージを入力';
const CHAT_INPUT_MAX = 20;
// biome-ignore lint/suspicious/noControlCharactersInRegex: Reject control characters, which make the placeholder more than one line of text.
const CONTROL = /[\u0000-\u001f\u007f-\u009f]/;

/** The ids of the blanks of a worksheet or a list, for the handle types (a literal worksheet declares its slot keys). */
type Lines<S> = S extends {panels: readonly {dialogue: readonly unknown[]}[]} ? S['panels'][number]['dialogue'][number] : S extends {dialogue: readonly unknown[]} ? S['dialogue'][number] : never;
type SlotIds<D> = D extends {slots?: infer Slots} ? Extract<keyof NonNullable<Slots>, string> : never;

function sheetOf(input: ChatInput): ChatSheet {
  if (!input || typeof input !== 'object') throw new Error('chat(sheet) needs a comic worksheet {version, title, layout, cast, panels} or a list {version, title, cast, dialogue}');
  if (input.version !== 1) throw new Error(`chat(): version must be 1 (got ${JSON.stringify(input.version)})`);
  if (typeof input.title !== 'string' || input.title === '') throw new Error('chat(): title is the name of the chat');
  if (!input.cast || typeof input.cast !== 'object') throw new Error('chat(): cast is {id: {name}} of the people');
  const copy = (blank: ChatSheet['blank']) => (blank === undefined ? {} : {blank});
  if ('panels' in input) {
    // the same data as the comic: its checks run on the way (ids, templates, cast), then the lines are joined in panel order
    const sheet = comic(input).sheet;
    const dialogue = sheet.panels.flatMap(p => p.dialogue.map((d): ChatMessage => ({...d, id: `${p.id}.${d.id}`, panel: p.id})));
    return {version: 1, title: sheet.title, cast: {...sheet.cast}, dialogue, ...copy(sheet.blank)};
  }
  if (!Array.isArray(input.dialogue)) throw new Error('chat(): dialogue is a list of lines {id, who, kind, tpl}');
  const ids = new Set<string>();
  const dialogue = input.dialogue.map((d): ChatMessage => {
    const b = speechBubble(d);
    if (ids.has(b.id)) throw new Error(`chat(): two lines have the id "${b.id}"`);
    ids.add(b.id);
    return b;
  });
  const slotIds = new Set(dialogue.flatMap(d => Object.keys(d.slots ?? {})));
  for (const d of dialogue) if (slotIds.has(d.id)) throw new Error(`chat(): the line id "${d.id}" is also a blank id (a line and a blank cannot share a name for connect()); rename the line or the blank`);
  for (const [k, c] of Object.entries(input.cast)) {
    if (!COMIC_ID.test(k)) throw new Error(`chat(): cast id ${JSON.stringify(k)} must be letters, digits, _ and - (starting with a letter; no . : @ #)`);
    if (c?.asset !== undefined && !COMIC_ID.test(c.asset)) throw new Error(`chat(): cast ${k}: asset id ${JSON.stringify(c.asset)} must be letters, digits, _ and -`);
  }
  return {version: 1, title: input.title, cast: {...input.cast}, dialogue, ...copy(input.blank)};
}

/**
 * A chat screen: the dialogue stacked from the top, the `self` speaker (default `me`) on the right, the others on the left with a round face and their name.
 * It takes the same worksheet as comic(), so a value of a blank is drawn the same in both.
 *   chat({version: 1, title: '相談', cast: {me: {name: '私'}, ai: {name: 'アシスタント'}}, dialogue: [{id: 'a', who: 'me', kind: 'say', tpl: '{doc}をまとめてください'}], ...}, {input: true})
 */
export function chat<const Id extends string = never, const Sheet extends ChatInput = ChatInput>(
  sheet: Sheet, opts?: ChatOpts & {id?: Id},
): ChatBand & Declares<Id | SlotIds<Lines<Sheet>>> & HandleOf<Id>;
export function chat(input: ChatInput, opts: ChatOpts = {}): ChatBand {
  const sheet = sheetOf(input);
  if (opts.self !== undefined) {
    if (typeof opts.self !== 'string' || !Object.hasOwn(sheet.cast, opts.self)) throw new Error(`chat(): self ${JSON.stringify(opts.self)} is not a key of cast (the speaker drawn on the right)`);
  }
  if (opts.width !== undefined && (!Number.isInteger(opts.width) || opts.width < CHAT_W || opts.width > CHAT_W_MAX || opts.width % 4 !== 0)) {
    throw new Error(`chat(): width is a whole number from ${CHAT_W} to ${CHAT_W_MAX} in steps of 4 (got ${JSON.stringify(opts.width)})`);
  }
  if (opts.fontSize !== undefined && (!Number.isInteger(opts.fontSize) || opts.fontSize < FONT_SIZE_MIN || opts.fontSize > FONT_SIZE_MAX)) throw new Error(`chat(): fontSize must be a whole number from ${FONT_SIZE_MIN} to ${FONT_SIZE_MAX} (got ${String(opts.fontSize)})`);
  let text: string | undefined;
  if (opts.input !== undefined) {
    text = opts.input === true ? CHAT_INPUT_DEFAULT : opts.input;
    if (typeof text !== 'string' || text.trim() === '' || CONTROL.test(text)) throw new Error(`chat(): input is true or the placeholder of the message box (one line of text; got ${JSON.stringify(opts.input)})`);
    if ([...text].length > CHAT_INPUT_MAX) throw new Error(`chat(): input has ${[...text].length} characters; the message box takes at most ${CHAT_INPUT_MAX}`);
  }
  const characters = Object.fromEntries(Object.entries(opts.characters ?? {}).map(([key, manifest]) => {
    const character = loadCharacter(manifest);
    if (character.id !== key) throw new Error(`chat(): characters のキー "${key}" を素材の id "${character.id}" に合わせてください`);
    return [key, character];
  }));
  const band: ChatBand = {type: 'chat', sheet, ...(Object.keys(characters).length ? {characters} : {}),
    ...(opts.self === undefined ? {} : {self: opts.self}), ...(opts.width === undefined ? {} : {width: opts.width}), ...(opts.fontSize === undefined ? {} : {fontSize: opts.fontSize}), ...(opts.separators === undefined ? {} : {separators: opts.separators}),
    ...(text === undefined ? {} : {input: text}), ...(opts.id === undefined ? {} : {id: opts.id}), ...scopeOpt(opts, 'chat()'), ...revealOf(opts)};
  return withHandle(band, opts.id);
}
