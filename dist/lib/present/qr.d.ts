/** The largest version we encode. 10-M holds 213 bytes, comfortably above any URL D10 hands us. */
export declare const QR_MAX_VERSION = 10;
/** The largest byte length that fits (213 at 10-M). */
export declare const QR_MAX_BYTES: number;
/** The smallest version 1..10 at level M whose byte mode holds `byteLength` bytes, or null when none does. */
export declare function qrVersionFor(byteLength: number): number | null;
/** Build the symbol with a given mask (0..7); exposed for tests that compare against a reference built with a fixed mask. */
export declare function encodeQrWithMask(text: string, mask: number | null): boolean[][];
/** Encode `text` (UTF-8 bytes) at level M in the smallest version 1..10, choosing the mask by the standard penalty. true = dark. */
export declare function encodeQr(text: string): boolean[][];
export interface QrSvgOptions {
    /** Pixels per module for width/height (the viewBox is in modules). Default 4. */
    moduleSize?: number;
    /** Quiet zone in modules. Default 4, the minimum the standard asks for. */
    margin?: number;
    dark?: string;
    light?: string;
}
/** A compact SVG: one light background rect and one path whose subpaths are the horizontal dark runs of each row. */
export declare function qrSvg(text: string, opts?: QrSvgOptions): string;
/**
 * Unicode half blocks, two module rows per line, with a 4-module quiet zone.
 * Polarity: LIGHT modules (and the quiet zone) are drawn as blocks, dark modules as spaces. On the usual dark-background
 * terminal the blocks show in the light foreground colour, so the code reads with the correct polarity and a visible
 * light frame. On a light-background terminal the same text shows inverted (light modules dark); modern phone
 * scanners (iOS Camera, Google Lens, ZXing) read inverted codes, but we cannot be correct for both backgrounds without
 * colour escapes, and a dark background is what most terminals default to.
 */
export declare function qrTerminal(text: string): string;
