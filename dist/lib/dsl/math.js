import { texToSvg } from '../math-tex.js';
import { ROLES } from '../tokens.js';
import { assertNoReveal, withHandle } from './shared.js';
export function math(tex, opts = {}) {
    assertNoReveal(opts, 'math()');
    if (typeof tex !== 'string' || !tex.trim())
        throw new Error('math(tex) needs the TeX source of the formula (a non-empty string)');
    if (opts.align !== undefined && !['left', 'center', 'right'].includes(opts.align))
        throw new Error(`math(): align must be 'left', 'center' or 'right' (got ${opts.align})`);
    if (opts.tone !== undefined && !['text', 'accent', 'muted', 'danger'].includes(opts.tone))
        throw new Error(`math(): tone must be 'text', 'accent', 'muted' or 'danger' (got ${opts.tone})`);
    if (opts.role !== undefined && !(opts.role in ROLES))
        throw new Error(`math(): role must be one of ${Object.keys(ROLES).join(', ')} (got ${opts.role})`);
    return withHandle({ type: 'math', tex, drawing: texToSvg(tex, !opts.inline), role: opts.role ?? 'body', align: opts.align ?? 'center', tone: opts.tone ?? 'text', alt: opts.alt?.trim() || tex, ...(opts.id === undefined ? {} : { id: opts.id }) }, opts.id);
}
