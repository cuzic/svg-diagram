import { assertSolidText, richField } from '../rich.js';
import { HEADLINE_ROLES, isSolidTone } from '../tokens.js';
import { assertOneOf, assertTextRole, EMPHASIS_TONES, withHandle } from './shared.js';
export function banner(opts) {
    if (opts.headline === undefined)
        throw new Error('banner() needs a headline (the text key is headline, not text / title)');
    assertOneOf(opts.tone, EMPHASIS_TONES, 'banner() tone');
    assertTextRole(opts.headlineRole, HEADLINE_ROLES, 'banner() headlineRole');
    const headline = richField(opts.headline, { field: 'banner() headline', bold: true, tone: opts.headlineTone });
    const sub = richField(opts.sub, { field: 'banner() sub', bold: false, tone: opts.subTone ?? (isSolidTone(opts.tone) ? undefined : 'muted') });
    const text = { ...(typeof opts.headline === 'string' ? {} : { headline: headline.text ?? '' }), ...(typeof opts.sub === 'string' || opts.sub === undefined ? {} : { sub: sub.text }) };
    const spans = headline.spans || sub.spans ? { spans: { ...(headline.spans ? { headline: headline.spans } : {}), ...(sub.spans ? { sub: sub.spans } : {}) } } : {};
    const band = { type: 'banner', tone: opts.tone ?? 'accent', ...opts, ...text, ...spans };
    assertSolidText(band, 'banner()');
    return withHandle(band, opts.id);
}
