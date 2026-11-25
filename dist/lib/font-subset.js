// Cutting a font down to the characters a figure uses, with HarfBuzz's own subsetter (the wasm harfbuzzjs ships; its C API, called directly).
//
// Why: resvg parses every font it is given each time it draws, and has no way to keep the parsed fonts between drawings — a 14 MB Japanese
// font costs seconds per figure, the drawing itself milliseconds. The same font cut to the 50–160 characters a figure uses is ~80 KB and
// costs ~15 ms to cut and ~30 ms to load, and draws the same pixels: layout tables (kerning, ligatures), outlines, hinting and the name table
// are kept for the glyphs that stay. Nothing is cached on disk: the cut is cheap enough to do each time.
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
let api = null;
function load() {
    if (!api) {
        const file = fileURLToPath(import.meta.resolve('harfbuzzjs/dist/harfbuzz-subset.wasm'));
        const instance = new WebAssembly.Instance(new WebAssembly.Module(fs.readFileSync(file)), {});
        api = instance.exports;
        api._initialize?.();
    }
    return api;
}
/** The size of the wasm heap in bytes (it grows to the largest font cut and never shrinks; a test watches that it does not grow with the number of cuts). */
export function heapBytes() { return load().memory.buffer.byteLength; }
/**
 * `font` (a .ttf/.otf, or a .ttc with `faceIndex`) cut to the glyphs of `codepoints`. Characters the font lacks are ignored. The result is a
 * single-face font. Throws when the data is not a font HarfBuzz can read.
 */
export function subsetFont(font, faceIndex, codepoints) {
    const x = load();
    const data = x.malloc(font.length);
    if (!data)
        throw new Error('font subsetting: out of memory');
    let blob = 0, face = 0, input = 0, out = 0, outBlob = 0;
    try {
        new Uint8Array(x.memory.buffer).set(font, data); // (after malloc: the heap may have grown, so the view is taken now)
        blob = x.hb_blob_create(data, font.length, 2 /* HB_MEMORY_MODE_WRITABLE: the blob does not free it */, 0, 0);
        face = x.hb_face_create(blob, faceIndex);
        input = x.hb_subset_input_create_or_fail();
        if (!input)
            throw new Error('font subsetting: out of memory');
        const unicodes = x.hb_subset_input_unicode_set(input);
        for (const cp of codepoints)
            x.hb_set_add(unicodes, cp);
        out = x.hb_subset_or_fail(face, input);
        if (!out)
            throw new Error('font subsetting: HarfBuzz could not read the font (or cut it)');
        outBlob = x.hb_face_reference_blob(out);
        const len = x.hb_blob_get_length(outBlob), ptr = x.hb_blob_get_data(outBlob, 0);
        if (!len)
            throw new Error('font subsetting: the cut font is empty');
        return new Uint8Array(x.memory.buffer).slice(ptr, ptr + len);
    }
    finally {
        if (outBlob)
            x.hb_blob_destroy(outBlob);
        if (out)
            x.hb_face_destroy(out);
        if (input)
            x.hb_subset_input_destroy(input);
        if (face)
            x.hb_face_destroy(face);
        if (blob)
            x.hb_blob_destroy(blob);
        x.free(data);
    }
}
