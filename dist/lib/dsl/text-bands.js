import { resolveIcon } from '../icon-registry.js';
import { walkBands } from '../rules.js';
import { CAUSE_ROLES } from '../toc.js';
import { assertSolidText, richBoxFields, richField } from '../rich.js';
import { ROLES, HEADLINE_ROLES, OPT_IN_TEXT_MAX, isSolidTone } from '../tokens.js';
import { ALIGNS, assertBoxTone, assertFontSize, assertNoReveal, assertOneOf, assertTextRole, EMPHASIS_TONES, revealOf, TEXT_TONES, withHandle } from './shared.js';
// text: a string (exactly its characters) or an array with em.* parts: caption(['Claude in ', em.b('Chrome')]).
export function caption(text, opts = {}) {
    assertOneOf(opts.align, ALIGNS, 'caption() align');
    assertOneOf(opts.role, Object.keys(ROLES), 'caption() role');
    assertOneOf(opts.tone, TEXT_TONES, 'caption() tone');
    const tone = opts.tone ?? 'muted';
    const rich = richField(text, { field: 'caption()', bold: !!opts.bold, tone });
    return { type: 'caption', text: rich.text ?? '', ...(rich.spans ? { spans: { text: rich.spans } } : {}), align: opts.align ?? 'center', role: opts.role ?? 'label', tone, bold: !!opts.bold, mono: !!opts.mono, ...revealOf(opts) };
}
// `step`: a number/string drawn as a solid numbered badge over the title's
// own baseline (requires `title` — the badge has nothing to align to
// without it).
//
// Types: `step` requires `title`; `size` is one of FontSize (an integer >= 14); unknown keys are rejected; the
// literal `id` is remembered so connect() refs to it can be checked by add().
// Every key box() takes. `satisfies` makes tsc fail when BoxOpts gains or loses a key without this list following.
const BOX_KEYS = {
    id: 1, tone: 1, dashed: 1, align: 1, tag: 1, tagTone: 1, tagAt: 1, stamp: 1, padX: 1, padY: 1, flex: 1, width: 1, col: 1, span: 1, reveal: 1, until: 1,
    titleTone: 1, titleMono: 1, bodyTone: 1, bodyMono: 1, noteTone: 1, step: 1, icon: 1, iconTone: 1, iconAt: 1, iconSize: 1, frame: 1, size: 1,
    title: 1, body: 1, lines: 1, note: 1,
};
export function box(opts) {
    assertOneOf(opts.tone, EMPHASIS_TONES, 'box() tone');
    assertOneOf(opts.align, ALIGNS, 'box() align');
    assertOneOf(opts.tagTone, ['accent', 'muted', 'danger'], 'box() tagTone');
    for (const k of ['titleTone', 'bodyTone', 'noteTone', 'iconTone'])
        assertOneOf(opts[k], TEXT_TONES, `box() ${k}`);
    const unknown = Object.keys(opts).filter(k => !(k in BOX_KEYS));
    if (unknown.length)
        throw new Error(`box(): unknown option ${unknown.map(k => `'${k}'`).join(', ')} — the text goes in title / body / lines / note (all options: ${Object.keys(BOX_KEYS).join(', ')})`);
    if (opts.size !== undefined) {
        assertFontSize(opts.size); // the px check stays; lint says the value has no effect (rule box-size-ignored)
    }
    // the plain text (and spans) of every rich field go over the copied options: a band never holds an array
    const band = { type: 'box', ...opts, ...richBoxFields(opts) };
    assertSolidText(band, 'box()');
    if (band.step != null && !band.title)
        throw new Error('box({step}) needs a title — the badge aligns to the title\'s first line');
    // the glyph is resolved here (the shell) and carried on the band, so emit stays free of I/O
    if (band.icon !== undefined)
        band.iconGlyph = resolveIcon(band.icon, 'box({icon})');
    if ((band.iconAt !== undefined || band.iconSize !== undefined) && band.icon === undefined)
        throw new Error('box({iconAt, iconSize}) needs an icon');
    if (band.iconAt !== undefined && band.iconAt !== 'left' && band.iconAt !== 'top')
        throw new Error(`box({iconAt}) is 'left' or 'top' (got ${JSON.stringify(band.iconAt)})`);
    return withHandle(band, opts.id);
}
/**
 * The largest scale fill: true may try. 1.8 as ever, but an opted-in size (banner headlineRole, bars / plane labelRole)
 * is not scaled past OPT_IN_TEXT_MAX px: a 'display' headline stops at 1.28x, a 'stat' label (34px) never reaches it.
 * The usual roles (a stat({size: 'display'}) included) are not held back, so a diagram without these options scales as before.
 */
export function fillScaleLimit(bands) {
    const optIn = walkBands(bands).flatMap(b => b.type === 'banner' && b.headlineRole ? [ROLES[b.headlineRole]] : (b.type === 'bars' || b.type === 'plane') && b.labelRole ? [ROLES[b.labelRole]] : b.type === 'image' ? [b.labelRole, ...(b.marks ?? []).map(m => m.role), ...(b.labels ?? []).map(l => l.role)].flatMap(r => r ? [ROLES[r]] : []) : []);
    return Math.min(1.8, optIn.length ? OPT_IN_TEXT_MAX / Math.max(...optIn) : 1.8);
}
/** The symbol and the word printed for each stat() confidence (ADR 0023 D8): never a colour alone. */
const CONFIDENCE_LABEL = { primary: '◎ 一次資料', secondary: '○ 報道・二次資料', unverified: '△ 未確認' };
/** The printed text of a confidence: the override if written, else the default with or without its leading symbol. */
function confidenceText(c, opts) {
    return opts.confidenceLabels?.[c] ?? (opts.confidenceStyle === 'text' ? CONFIDENCE_LABEL[c].replace(/^\S+\s/, '') : CONFIDENCE_LABEL[c]);
}
export function stat(value, label, opts = {}) {
    if (opts.size !== undefined && opts.size !== 'stat' && opts.size !== 'display')
        throw new Error(`stat(): size must be 'stat' or 'display' (got ${opts.size})`);
    const text = String(value);
    if (opts.confidence !== undefined && !(opts.confidence in CONFIDENCE_LABEL))
        throw new Error(`stat(): confidence must be 'primary', 'secondary' or 'unverified' (got ${JSON.stringify(opts.confidence)})`);
    if (opts.confidenceStyle !== undefined && opts.confidenceStyle !== 'symbol' && opts.confidenceStyle !== 'text')
        throw new Error(`stat(): confidenceStyle must be 'symbol' or 'text' (got ${JSON.stringify(opts.confidenceStyle)})`);
    for (const [k, v] of Object.entries(opts.confidenceLabels ?? {}))
        if (!(k in CONFIDENCE_LABEL) || typeof v !== 'string' || !v.trim() || /[\r\n]/.test(v))
            throw new Error(`stat(): confidenceLabels takes primary / secondary / unverified, each a non-empty one-line text (got ${JSON.stringify({ [k]: v })})`);
    if (opts.source === undefined && opts.confidence !== undefined)
        throw new Error(`stat(${JSON.stringify(text)}): confidence needs a source (where the number comes from; write the source, or drop the number)`);
    if (opts.source !== undefined && (typeof opts.source !== 'string' || !opts.source.trim() || /[\r\n]/.test(opts.source)))
        throw new Error(`stat(${JSON.stringify(text)}): source must be a non-empty one-line string`);
    // 'solid' / 'solid-danger' fill the box (white text, so no tone of its own on the value or the label); any other tone colours the value
    const solid = opts.tone === 'solid' || opts.tone === 'solid-danger' ? opts.tone : undefined;
    // 'accent' also fills the card with the accent tone's fill (and outline), as a box of that tone does; the value stays accent text, the label is the normal text colour (muted is too faint on the fill)
    const accent = opts.tone === 'accent' ? 'accent' : undefined;
    const rich = richField(label, { field: 'stat() label', bold: false, tone: solid || accent ? undefined : 'muted' });
    return withHandle({
        type: 'box', id: opts.id, ...(solid ? { tone: solid } : accent ? { tone: accent } : {}), flex: opts.flex, width: opts.width, col: opts.col, span: opts.span, ...revealOf(opts),
        align: 'center', lines: [
            { text, role: opts.size ?? 'stat', bold: true, tone: solid ? undefined : opts.tone },
            { text: rich.text ?? '', ...(solid || accent ? {} : { tone: 'muted' }), ...(rich.spans ? { spans: rich.spans } : {}) },
            ...(opts.source !== undefined ? [{ text: `出典: ${opts.source}${opts.confidence ? `  ${confidenceText(opts.confidence, opts)}` : ''}`, role: 'note', ...(solid || accent ? {} : { tone: 'muted' }) }] : []),
        ], statValue: text, ...(opts.source !== undefined ? { evidence: { source: opts.source, ...(opts.confidence ? { confidence: opts.confidence } : {}) } } : {}),
    }, opts.id);
}
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
export function group(children, opts = {}) {
    assertBoxTone(opts.tone, 'group()');
    if ('gap' in opts && opts.gap !== undefined)
        throw new Error('group(): there is no gap option — the space between boxes is the gap of the row() they sit in (row([...], {gap})), or diagram({gap}) between bands');
    if (opts.valign !== undefined && !['top', 'center', 'stretch'].includes(opts.valign))
        throw new Error(`group(): valign must be 'top', 'center' or 'stretch', got ${JSON.stringify(opts.valign)}`);
    const title = richField(opts.title, { field: 'group() title', bold: true, tone: opts.titleTone ?? (opts.tone === 'accent' ? 'accent' : 'text') });
    if (opts.frame === false && (title.text || opts.dashed || opts.tone))
        throw new Error('group({frame: false}) draws no frame, so it takes no title, tone or dashed');
    return withHandle({ type: 'group', children: [children].flat(), title: title.text, ...(title.spans ? { spans: { title: title.spans } } : {}), titleTone: opts.titleTone, titleAlign: opts.titleAlign, tone: opts.tone ?? 'muted', dashed: opts.dashed ?? (opts.tone === 'plain' ? true : undefined), pad: opts.pad ?? (opts.frame === false ? 0 : undefined), frame: opts.frame, stamp: opts.stamp, ...(opts.valign ? { valign: opts.valign } : {}), id: opts.id, flex: opts.flex, width: opts.width, span: opts.span, col: opts.col, ...revealOf(opts) }, opts.id);
}
// Key for line styles / tones used in the diagram. items:
//   {line: 'solid'|'dashed'|'dotted'|'double', arrow?: 'end'|'both'|'none', weight?: 'strong', label}
//   {tone: 'accent'|'muted'|'plain'|'danger'|'new'|'changed'|'removed', label}
export function legend(items, opts = {}) {
    assertNoReveal(opts, 'legend()');
    for (const it of items)
        if (it.weight && it.line === 'double')
            throw new Error(`legend(): weight '${it.weight}' cannot go with line 'double' ("${it.label}")`);
    for (const it of items) {
        if (it.role !== undefined && !(it.role in CAUSE_ROLES))
            throw new Error(`legend(): item "${it.label}" has role ${String(it.role)} (use ${Object.keys(CAUSE_ROLES).join(', ')})`);
        if (it.edge !== undefined && !['and', 'back', 'blocks'].includes(it.edge))
            throw new Error(`legend(): item "${it.label}" has edge ${String(it.edge)} (use 'and', 'back' or 'blocks')`);
        if (it.mark !== undefined && it.mark !== 'core')
            throw new Error(`legend(): item "${it.label}" has mark ${String(it.mark)} (use 'core')`);
        if (it.ftaEvent !== undefined && !['basic', 'undeveloped', 'house', 'condition'].includes(it.ftaEvent))
            throw new Error(`legend(): item "${it.label}" has ftaEvent ${String(it.ftaEvent)} (use 'basic', 'undeveloped', 'house' or 'condition')`);
        if (it.ftaGate !== undefined && !['and', 'or', 'vote', 'inhibit'].includes(it.ftaGate))
            throw new Error(`legend(): item "${it.label}" has ftaGate ${String(it.ftaGate)} (use 'and', 'or', 'vote' or 'inhibit')`);
    }
    // a weight sample is a line sample: the plain line unless `line` says otherwise
    return { type: 'legend', items: items.map(it => it.weight && !it.line ? { ...it, line: 'solid' } : it), align: opts.align ?? 'center' };
}
// Escape hatch. `draw(ctx)` must return a raw SVG fragment string; it
// receives its allocated origin/size and a couple of tone-aware helpers, but
// nothing stops it from emitting arbitrary markup — the fragment is passed
// through emit.ts unmodified. build() runs `lint-svg.ts --strict` on the
// finished file regardless, so an off-token color or sub-14px size written
// here still gets caught before the file is trusted — raw() only escapes
// layout, never the constraint system's verification step.
export function raw(opts) {
    assertNoReveal(opts, 'raw()');
    if (typeof opts.draw !== 'function')
        throw new Error('raw({draw}) needs a draw(ctx) function');
    return { type: 'raw', h: opts.h ?? 0, draw: opts.draw };
}
