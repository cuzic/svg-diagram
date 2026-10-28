export declare const DECK_USAGE = "Usage: svg-diagram deck <a.ts|a.svg>... [--out deck.html] [--title TEXT] [--cols N] [--csp] [--no-source-line] [--render svg]\n  (a deck views figures that build / check have passed; it does not lint them)";
export interface DeckArgs {
    files: string[];
    out: string;
    title?: string;
    cols?: number;
    csp: boolean;
    noSourceLine: boolean;
}
/** `error` is the message to print above the usage line; '' is the bare usage (no input). */
export type DeckArgsResult = {
    ok: true;
    args: DeckArgs;
} | {
    ok: false;
    error: string;
};
export declare function parseDeckArgs(args: readonly string[]): DeckArgsResult;
