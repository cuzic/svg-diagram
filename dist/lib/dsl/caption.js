import { richField } from '../rich.js';
import { rolesAt } from '../tokens.js';
import { ALIGNS, assertOneOf, revealOf, TEXT_TONES } from './shared.js';
// text: a string (exactly its characters) or an array with em.* parts: caption(['Claude in ', em.b('Chrome')]).
export function caption(text, opts = {}) {
    assertOneOf(opts.align, ALIGNS, 'caption() align');
    assertOneOf(opts.role, Object.keys(rolesAt(false, 1)), 'caption() role');
    assertOneOf(opts.tone, TEXT_TONES, 'caption() tone');
    const tone = opts.tone ?? 'muted';
    const rich = richField(text, { field: 'caption()', bold: !!opts.bold, tone });
    return { type: 'caption', text: rich.text ?? '', ...(rich.spans ? { spans: { text: rich.spans } } : {}), align: opts.align ?? 'center', role: opts.role ?? 'label', tone, bold: !!opts.bold, mono: !!opts.mono, ...revealOf(opts) };
}
