import { readDataImage } from '../image-sniff.js';
import { LABEL_ROLES } from '../tokens.js';
import { assertTextRole, revealOf, scopeOpt, withAnchors, withHandle } from './shared.js';
const IMAGE_TONES = ['plain', 'accent', 'danger', 'muted', 'new', 'changed', 'removed', 'solid', 'solid-danger'];
export function image(src, opts = {}) {
    if (opts.pad !== undefined && !(opts.pad >= 0 && Number.isFinite(opts.pad)))
        throw new Error(`image(): pad must be a finite number >= 0 (got ${opts.pad})`);
    const over = opts.over === undefined ? [] : [opts.over].flat();
    for (const [i, c] of over.entries())
        if (c?.type === 'connect')
            throw new Error(`image(): over[${i}] is a connect() — add connectors at the top level of the diagram (they may point at ids inside the picture)`);
    if (!opts.alt?.trim() && !opts.decorative)
        throw new Error('image(): alt is required (what the picture shows) — or pass decorative: true when it adds nothing');
    if (opts.alt && opts.decorative)
        throw new Error('image(): alt and decorative: true contradict each other');
    for (const k of ['width', 'height']) {
        const v = opts[k];
        if (v !== undefined && (!(v > 0) || !Number.isFinite(v)))
            throw new Error(`image(): ${k} must be a finite number > 0 (got ${opts[k]})`);
    }
    if (opts.width !== undefined && opts.height !== undefined)
        throw new Error('image(): give width or height, not both (the other follows the picture\'s aspect ratio)');
    assertTextRole(opts.labelRole, LABEL_ROLES, 'image() labelRole');
    if (opts.align !== undefined && !['left', 'center', 'right'].includes(opts.align))
        throw new Error(`image(): align must be 'left', 'center' or 'right' (got ${opts.align})`);
    const unit = (n) => Number.isFinite(n) && n >= 0 && n <= 1;
    const tone = (t, where) => { if (t !== undefined && !IMAGE_TONES.includes(t))
        throw new Error(`image(): ${where} tone "${t}" is not one of ${IMAGE_TONES.join(', ')}`); };
    (opts.marks ?? []).forEach((m, i) => {
        const [x, y, w, h] = m.rect ?? [];
        if (![x, y, w, h].every(n => typeof n === 'number' && unit(n)) || !(w > 0 && h > 0) || x + w > 1.0001 || y + h > 1.0001)
            throw new Error(`image(): mark ${i + 1} rect must be [x, y, w, h] as fractions of the picture, inside it (got ${JSON.stringify(m.rect)})`);
        tone(m.tone, `mark ${i + 1}`);
        assertTextRole(m.role, LABEL_ROLES, `image() mark ${i + 1} role`);
        if (m.label !== undefined && !m.label.trim())
            throw new Error(`image(): mark ${i + 1} label is empty`);
    });
    (opts.labels ?? []).forEach((l, i) => {
        if (!l.text?.trim())
            throw new Error(`image(): label ${i + 1} has no text`);
        if (!Array.isArray(l.at) || l.at.length !== 2 || !l.at.every(unit))
            throw new Error(`image(): label ${i + 1} "at" must be [x, y] as fractions of the picture (0 to 1) (got ${JSON.stringify(l.at)})`);
        if (l.anchor !== undefined && !['start', 'middle', 'end'].includes(l.anchor))
            throw new Error(`image(): label ${i + 1} anchor must be 'start', 'middle' or 'end' (got ${l.anchor})`);
        tone(l.tone, `label ${i + 1}`);
        assertTextRole(l.role, LABEL_ROLES, `image() label ${i + 1} role`);
    });
    const ids = (opts.marks ?? []).map(m => m.id).filter((id) => !!id);
    if (new Set(ids).size !== ids.length)
        throw new Error('image(): each mark id must be unique');
    if (opts.id !== undefined && ids.includes(opts.id))
        throw new Error(`image(): the band's id "${opts.id}" is also a mark's id — each id must be unique`);
    // a data URI is read at once; a file waits for the diagram to be drawn (its relative path means "next to the source", which only the loader knows)
    const text = src instanceof URL ? src.href : src;
    const file = text.startsWith('data:') ? readDataImage(text) : undefined;
    const band = {
        type: 'image', src: text, ...(file ? {} : { unresolved: true }), href: file?.href ?? '', naturalW: file?.w ?? 0, naturalH: file?.h ?? 0, bytes: file?.bytes ?? 0, alt: opts.alt?.trim() ?? '',
        ...(opts.id === undefined ? {} : { id: opts.id }), ...scopeOpt(opts, 'image()'), ...revealOf(opts),
        ...(opts.width === undefined ? {} : { width: opts.width }), ...(opts.height === undefined ? {} : { height: opts.height }), ...(opts.align === undefined ? {} : { align: opts.align }), ...(opts.labelRole === undefined ? {} : { labelRole: opts.labelRole }),
        ...(opts.marks?.length ? { marks: opts.marks.map(m => ({ ...m, rect: [...m.rect] })) } : {}),
        ...(opts.labels?.length ? { labels: opts.labels.map(l => ({ ...l })) } : {}),
        ...(over.length ? { children: over } : {}), ...(opts.pad === undefined ? {} : { pad: opts.pad }),
    };
    return withHandle(withAnchors(band, (opts.marks ?? []).map(m => m.id)), opts.id);
}
