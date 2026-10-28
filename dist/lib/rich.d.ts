import type { TextTone } from './types/core.ts';
import type { BoxBand, BoxOpts, RichSpans, RichText, Span, Styled } from './types/text-bands.ts';
/** The brand of a Styled part. */
export declare const RICH: unique symbol;
/** The parts of rich text: em.b('bold'), em.danger('red'), em.danger(em.b('both')). Pass them in an array next to plain strings. */
export declare const em: {
    /** Bold. */
    b: (of: string | Styled) => Styled;
    accent: (of: string | Styled) => Styled;
    danger: (of: string | Styled) => Styled;
    muted: (of: string | Styled) => Styled;
    /** The normal text colour, inside a run that is in another tone. */
    text: (of: string | Styled) => Styled;
};
/** What the field being flattened is: where it is (for messages), whether its run is bold, and its tone. */
export interface RichContext {
    field: string;
    bold: boolean;
    tone?: TextTone;
}
/**
 * Flattens rich text into its plain text and spans. The spans are the pieces in order (neighbours of one style are merged), so
 * they concatenate to `text`; text with no bold / tone part has `spans: undefined`.
 * Throws for a part that would not show: em.b() in a bold run, a tone equal to the run's, a tone inside another tone.
 */
export declare function richOf(input: RichText, ctx: RichContext): {
    text: string;
    spans?: Span[];
};
/**
 * A solid / solid-danger box draws every run in white, so a colour of its own (a *Tone field, a line's tone, an em.* colour)
 * would be the fill's own colour or a dark one on it. em.b() is fine. `what` names the caller for the message.
 */
export declare function assertSolidText(band: {
    tone?: string;
    titleTone?: string;
    bodyTone?: string;
    noteTone?: string;
    iconTone?: string;
    headlineTone?: string;
    subTone?: string;
    lines?: readonly unknown[];
    spans?: RichSpans;
}, what: string): void;
/** Throws when hand-made spans (add() takes a band as it is) do not concatenate to the text they claim to be the pieces of. */
export declare function assertSpans(text: string, spans: Span[], what: string): void;
interface Field {
    text: string | undefined;
    spans?: Span[];
}
/** A text field as the band keeps it (banner headline / sub, caption text, group title ...): a string stays as it is; an array becomes its plain text (undefined when empty) and spans. */
export declare function richField(input: RichText | undefined, ctx: RichContext): Field;
/**
 * The text fields of a box (box() and a swimlane step) in band form. Only what changed is returned, so a box written with
 * strings only is the same band as before; spread it AFTER the options (`{type: 'box', ...opts, ...richBoxFields(opts)}`) so
 * no array is left in the band.
 */
export declare function richBoxFields(opts: BoxOpts, what?: string): Partial<Pick<BoxBand, 'title' | 'body' | 'note' | 'lines' | 'spans'>>;
export {};
