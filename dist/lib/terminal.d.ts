export interface TermInfo {
    /** DA1 attributes (4 = sixel). null when the terminal never answered. */
    da1: number[] | null;
    /** Text-area size in pixels (CSI 14 t), cell size (CSI 16 t), and the grid in columns/rows, when known. */
    windowPx: {
        w: number;
        h: number;
    } | null;
    cellPx: {
        w: number;
        h: number;
    } | null;
    cols: number | null;
    rows: number | null;
    /** XTVERSION, e.g. "tmux 3.3a" or "WindowsTerminal 1.22". */
    version: string | null;
}
/** CSI 16 t, CSI 14 t, XTVERSION, then DA1 — which every terminal answers, so it marks the end of the replies. */
export declare const QUERY = "\u001B[16t\u001B[14t\u001B[>0q\u001B[c";
export declare function parseReplies(raw: string): Omit<TermInfo, 'cols' | 'rows'> & {
    complete: boolean;
};
export declare const supportsSixel: (t: Pick<TermInfo, 'da1'>) => boolean;
export declare const isTmux: (t: Pick<TermInfo, 'version'>) => boolean;
/**
 * Ask the controlling terminal (not stdin, which may be a pipe). null when there is none. Only call it when stdout is that
 * terminal: the replies arrive as input, so asking a terminal the output is not going to would inject them into whatever
 * runs there. Raw mode is put back on every way out, including Ctrl-C (which raw mode turns into a byte) and kill signals.
 */
export declare function queryTerminal(timeoutMs?: number): Promise<TermInfo | null>;
/** The widest picture, in pixels, that fits the terminal; and a cap on its height. */
export declare function fitBox(t: Pick<TermInfo, 'windowPx' | 'cellPx' | 'cols' | 'rows'> | null, o?: {
    cellWidthGuess?: number;
    fallbackWidth?: number;
}): {
    maxW: number;
    maxH: number;
    estimated: boolean;
};
/** The scale (at most 1: it never enlarges) at which a w×h picture fits maxW×maxH. */
export declare function fitScale(w: number, h: number, maxW: number, maxH: number): number;
/** Wrap a sixel DCS for tmux's passthrough (`allow-passthrough on`): every ESC doubled, the whole in \ePtmux; … \e\\. */
export declare function tmuxPassthrough(seq: string): string;
