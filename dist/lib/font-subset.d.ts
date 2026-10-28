/** The size of the wasm heap in bytes (it grows to the largest font cut and never shrinks; a test watches that it does not grow with the number of cuts). */
export declare function heapBytes(): number;
/**
 * `font` (a .ttf/.otf, or a .ttc with `faceIndex`) cut to the glyphs of `codepoints`. Characters the font lacks are ignored. The result is a
 * single-face font. Throws when the data is not a font HarfBuzz can read.
 */
export declare function subsetFont(font: Uint8Array, faceIndex: number, codepoints: Iterable<number>): Uint8Array;
