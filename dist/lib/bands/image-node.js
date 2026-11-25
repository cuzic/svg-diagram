import { band } from '../band-def.js';
import { image as build } from '../dsl/image.js';
import { resolveImageBand } from '../image-file.js';
import { imageDefinition } from './image.js';
/** Read an image file before passing its band to the selective renderer. */
export function imageFile(src, opts) {
    const { baseDir = process.cwd(), ...options } = opts;
    const data = build(src, options);
    resolveImageBand(data, baseDir);
    return band(imageDefinition, data);
}
