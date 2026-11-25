import { band } from '../band-def.js';
import { math as build } from '../dsl/math.js';
import { mathDefinition } from '../math-band-definition.js';
/** Convert TeX with the optional MathJax dependency and attach its SVG layout. */
export function math(tex, opts) {
    const data = build(tex, opts);
    return band(mathDefinition, data);
}
