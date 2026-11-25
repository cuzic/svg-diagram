import type { Declares, HandleOf } from '../strict.ts';
import type { ComicBand, ComicDialogue, ComicOpts, ComicWorksheet } from '../types/comic.ts';
export type { BubbleKind, CharacterManifest, ComicAspect, ComicAt, ComicBand, ComicCast, ComicDialogue, ComicExpression, ComicFinding, ComicGeometry, ComicLayoutName, ComicOpts, ComicPanel, ComicSlotDef, ComicStage, ComicWorksheet, Values } from '../types/comic.ts';
/**
 * One line of speech (ADR 0074 calls it bubble(); that name is the bubble chart's): a template with blanks (`{id}`) and who says it. The shape is shared with chat().
 *   speechBubble({id: 'd1', who: 'me', kind: 'say', tpl: '最近、{change}ね。', slots: {change: {max: 8, prompt: '変化'}}})
 */
export declare function speechBubble(d: ComicDialogue): ComicDialogue;
type SlotIds<D> = D extends {
    slots?: infer Slots;
} ? Extract<keyof NonNullable<Slots>, string> : never;
/**
 * A comic with blanks: panels in a named layout, people at fixed places (left / center / right), bubbles over their heads. The values of the blanks are
 * not part of it (ADR 0074 D5).
 *   comic({version: 1, title: '早く帰る', layout: '1x4', cast: {me: {name: '私'}, col: {name: '同僚'}},
 *     panels: [{id: 'p1', stage: [{who: 'me', at: 'left', expression: 'neutral'}], dialogue: [{id: 'd1', who: 'me', kind: 'say', tpl: '週に一度は早く帰る'}]}, ...]})
 */
export declare function comic<const Id extends string = never, const Sheet extends ComicWorksheet = ComicWorksheet>(sheet: Sheet, opts?: ComicOpts & {
    id?: Id;
}): ComicBand & Declares<Id | SlotIds<Sheet['panels'][number]['dialogue'][number]>> & HandleOf<Id>;
